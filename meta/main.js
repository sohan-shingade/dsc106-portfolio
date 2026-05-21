import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

let data = [];
let commits = [];
let filteredCommits = [];
let xScale, yScale;
let commitProgress = 100;
let timeScale;
let commitMaxTime;
let hideTimeout;

const colors = d3.scaleOrdinal(d3.schemeTableau10);

async function loadData() {
  data = await d3.csv('loc.csv', (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));

  processCommits();

  timeScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([0, 100]);
  commitMaxTime = timeScale.invert(commitProgress);
  filteredCommits = commits;

  renderCommitInfo(filteredCommits);
  renderScatterPlot();
  updateFileDisplay(filteredCommits);

  document
    .getElementById('commit-progress')
    .addEventListener('input', onTimeSliderChange);
  onTimeSliderChange();

  setupScrollytelling();
}

function processCommits() {
  commits = d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      let first = lines[0];
      let { author, date, time, timezone, datetime } = first;
      let ret = {
        id: commit,
        url:
          'https://github.com/sohan-shingade/dsc106-portfolio/commit/' +
          commit,
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };
      Object.defineProperty(ret, 'lines', {
        value: lines,
        enumerable: false,
        writable: false,
        configurable: false,
      });
      return ret;
    });
  commits.sort((a, b) => a.datetime - b.datetime);
}

function renderCommitInfo(commitsToShow) {
  const dl = d3.select('#stats');
  dl.html('');

  if (commitsToShow.length === 0) {
    const item = dl.append('div').attr('class', 'stat');
    item.append('dt').text('Status');
    item.append('dd').text('No commits yet');
    return;
  }

  const lines = commitsToShow.flatMap((c) => c.lines);
  const avgLineLength = d3.mean(lines, (d) => d.length);
  const numFiles = d3.group(lines, (d) => d.file).size;
  const maxDepth = d3.max(lines, (d) => d.depth);
  const workByPeriod = d3.rollups(
    lines,
    (v) => v.length,
    (d) => d.datetime.toLocaleString('en', { dayPeriod: 'short' }),
  );
  const busiestPeriod = d3.greatest(workByPeriod, (d) => d[1]);

  const stats = [
    { label: 'Total <abbr title="Lines of code">LOC</abbr>', value: lines.length },
    { label: 'Total commits', value: commitsToShow.length },
    { label: 'Number of files', value: numFiles },
    { label: 'Avg line length', value: (avgLineLength?.toFixed(1) ?? '0') + ' chars' },
    { label: 'Max nesting depth', value: maxDepth ?? 'N/A' },
    { label: 'Most active period', value: busiestPeriod?.[0] ?? 'N/A' },
  ];

  for (const stat of stats) {
    const item = dl.append('div').attr('class', 'stat');
    item.append('dt').html(stat.label);
    item.append('dd').text(stat.value);
  }
}

function onTimeSliderChange() {
  const slider = document.getElementById('commit-progress');
  commitProgress = Number(slider.value);
  commitMaxTime = timeScale.invert(commitProgress);

  const timeEl = document.getElementById('commit-time');
  timeEl.textContent = commitMaxTime.toLocaleString('en', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);
  updateScatterPlot(data, filteredCommits);
  renderCommitInfo(filteredCommits);
  updateFileDisplay(filteredCommits);
}

function renderScatterPlot() {
  const width = 1000;
  const height = 600;
  const margin = { top: 10, right: 10, bottom: 30, left: 50 };

  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  const svg = d3
    .select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

  xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();

  yScale = d3
    .scaleLinear()
    .domain([0, 24])
    .range([usableArea.bottom, usableArea.top]);

  const gridlines = svg
    .append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usableArea.left}, 0)`);
  gridlines.call(
    d3.axisLeft(yScale).tickFormat('').tickSize(-usableArea.width),
  );

  svg
    .append('g')
    .attr('transform', `translate(0, ${usableArea.bottom})`)
    .attr('class', 'x-axis')
    .call(d3.axisBottom(xScale));

  svg
    .append('g')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .attr('class', 'y-axis')
    .call(
      d3
        .axisLeft(yScale)
        .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00'),
    );

  svg.append('g').attr('class', 'dots');

  svg.call(d3.brush().on('start brush end', brushed));
  svg.selectAll('.dots, .overlay ~ *').raise();

  updateScatterPlot(data, commits);
}

function updateScatterPlot(data, commits) {
  const svg = d3.select('#chart').select('svg');
  const dots = svg.select('g.dots');

  if (commits.length === 0) {
    dots.selectAll('circle').data([]).join('circle');
    const xAxisGroup = svg.select('g.x-axis');
    xAxisGroup.selectAll('*').remove();
    return;
  }

  xScale = xScale.domain(d3.extent(commits, (d) => d.datetime));

  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);

  const xAxisGroup = svg.select('g.x-axis');
  xAxisGroup.selectAll('*').remove();
  xAxisGroup.call(d3.axisBottom(xScale));

  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

  dots
    .selectAll('circle')
    .data(sortedCommits, (d) => d.id)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7)
    .on('mouseenter', (event, commit) => {
      clearTimeout(hideTimeout);
      d3.select(event.currentTarget).style('fill-opacity', 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      hideTimeout = setTimeout(() => updateTooltipVisibility(false), 300);
    });
}

function renderTooltipContent(commit) {
  const link = document.getElementById('commit-link');
  const date = document.getElementById('commit-date');
  const time = document.getElementById('tooltip-time');
  const author = document.getElementById('commit-author');
  const lines = document.getElementById('commit-lines');

  if (!commit || Object.keys(commit).length === 0) return;

  link.href = commit.url;
  link.textContent = commit.id;
  date.textContent = commit.datetime?.toLocaleString('en', {
    dateStyle: 'full',
  });
  time.textContent = commit.datetime?.toLocaleString('en', {
    timeStyle: 'short',
  });
  author.textContent = commit.author;
  lines.textContent = commit.totalLines;
}

function updateTooltipVisibility(isVisible) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.style.left = `${event.clientX}px`;
  tooltip.style.top = `${event.clientY}px`;
}

function isCommitSelected(selection, commit) {
  if (!selection) return false;
  const [[x0, y0], [x1, y1]] = selection;
  const x = xScale(commit.datetime);
  const y = yScale(commit.hourFrac);
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

function brushed(event) {
  const selection = event.selection;
  d3.selectAll('circle').classed('selected', (d) =>
    isCommitSelected(selection, d),
  );
  renderSelectionCount(selection);
  renderLanguageBreakdown(selection);
}

function renderSelectionCount(selection) {
  const selectedCommits = selection
    ? filteredCommits.filter((d) => isCommitSelected(selection, d))
    : [];

  const countElement = document.querySelector('#selection-count');
  countElement.textContent =
    selectedCommits.length > 0
      ? `${selectedCommits.length} commit${selectedCommits.length === 1 ? '' : 's'} selected`
      : 'No commits selected';
}

function renderLanguageBreakdown(selection) {
  const selectedCommits = selection
    ? filteredCommits.filter((d) => isCommitSelected(selection, d))
    : [];

  const container = document.getElementById('language-breakdown');

  if (selectedCommits.length === 0) {
    container.innerHTML = '';
    return;
  }

  const lines = selectedCommits.flatMap((d) => d.lines);
  const breakdown = d3.rollup(
    lines,
    (v) => v.length,
    (d) => d.type,
  );

  const sorted = d3.sort([...breakdown], (d) => -d[1]);

  container.innerHTML = '';
  for (const [language, count] of sorted) {
    const proportion = count / lines.length;
    const formatted = d3.format('.1~%')(proportion);
    container.innerHTML += `
      <div class="stat">
        <dt>${language}</dt>
        <dd>${count} lines (${formatted})</dd>
      </div>
    `;
  }
}

function updateFileDisplay(filteredCommits) {
  let lines = filteredCommits.flatMap((d) => d.lines);
  let files = d3
    .groups(lines, (d) => d.file)
    .map(([name, lines]) => ({ name, lines, type: lines[0].type }))
    .sort((a, b) => b.lines.length - a.lines.length);

  let filesContainer = d3
    .select('#files')
    .selectAll('div.file')
    .data(files, (d) => d.name)
    .join(
      (enter) =>
        enter
          .append('div')
          .attr('class', 'file')
          .call((div) => {
            div.append('dt').call((dt) => {
              dt.append('code');
              dt.append('small');
            });
            div.append('dd');
          }),
      (update) => update,
      (exit) => exit.remove(),
    );

  filesContainer.style('--color', (d) => colors(d.type));

  filesContainer.select('dt > code').text((d) => {
    const parts = d.name.split('/');
    const labIdx = parts.indexOf('lab');
    return labIdx >= 0 ? parts.slice(labIdx + 1).join('/') : parts.pop();
  });
  filesContainer.select('dt > small').text((d) => `${d.lines.length} lines`);

  filesContainer
    .select('dd')
    .selectAll('div.loc')
    .data((d) => d.lines)
    .join('div')
    .attr('class', 'loc');
}

function generateStepHTML(d, i) {
  const dateStr = d.datetime.toLocaleString('en', {
    dateStyle: 'full',
    timeStyle: 'short',
  });
  const fileCount = d3.rollups(
    d.lines,
    (D) => D.length,
    (dd) => dd.file,
  ).length;
  const fileWord = fileCount === 1 ? 'file' : 'files';
  const langBreakdown = d3
    .rollups(
      d.lines,
      (v) => v.length,
      (dd) => dd.type,
    )
    .sort((a, b) => b[1] - a[1]);
  const topLang = langBreakdown[0]?.[0]?.toUpperCase() ?? '';

  if (i === 0) {
    return `
      <p>On ${dateStr}, I made
      <a href="${d.url}" target="_blank">my very first commit</a> —
      ${d.totalLines} lines across ${fileCount} ${fileWord}.
      Mostly ${topLang} at this point, just getting the bones of the site
      in place. Not much to look at yet, but everyone has to start somewhere.</p>
    `;
  }

  const templates = [
    `<p>On ${dateStr}, I pushed
    <a href="${d.url}" target="_blank">another commit</a>.
    This one touched ${d.totalLines} lines in ${fileCount} ${fileWord},
    heavy on the ${topLang}. The site was starting to feel like a real thing.</p>`,

    `<p>By ${dateStr}, I was back at it with
    <a href="${d.url}" target="_blank">more changes</a> —
    ${d.totalLines} lines across ${fileCount} ${fileWord}.
    Mostly ${topLang} work this time around. Things were coming together.</p>`,

    `<p>Then on ${dateStr},
    <a href="${d.url}" target="_blank">another round of edits</a> landed.
    ${d.totalLines} lines, ${fileCount} ${fileWord}.
    Each commit brought it a little closer to what I had in mind.</p>`,

    `<p>On ${dateStr}, I made
    <a href="${d.url}" target="_blank">one more commit</a> —
    ${d.totalLines} lines across ${fileCount} ${fileWord}.
    Small steps, but they add up pretty quickly.</p>`,
  ];

  return templates[(i - 1) % templates.length];
}

function setupScrollytelling() {
  d3.select('#scatter-story')
    .selectAll('.step')
    .data(commits)
    .join('div')
    .attr('class', 'step')
    .html((d, i) => generateStepHTML(d, i));

  const scroller = scrollama();
  scroller
    .setup({
      container: '#scrolly-1',
      step: '#scrolly-1 .step',
    })
    .onStepEnter(onStepEnter);
}

function onStepEnter(response) {
  const commit = d3.select(response.element).datum();
  const commitDate = commit.datetime;
  commitProgress = timeScale(commitDate);
  commitMaxTime = commitDate;

  filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);

  const slider = document.getElementById('commit-progress');
  if (slider) slider.value = commitProgress;

  const timeEl = document.getElementById('commit-time');
  if (timeEl) {
    timeEl.textContent = commitMaxTime.toLocaleString('en', {
      dateStyle: 'long',
      timeStyle: 'short',
    });
  }

  updateScatterPlot(data, filteredCommits);
  renderCommitInfo(filteredCommits);
  updateFileDisplay(filteredCommits);
}

const tooltip = document.getElementById('commit-tooltip');
tooltip.addEventListener('mouseenter', () => clearTimeout(hideTimeout));
tooltip.addEventListener('mouseleave', () => updateTooltipVisibility(false));

loadData();
