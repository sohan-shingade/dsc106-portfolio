import { fetchJSON, renderProjects, fetchGitHubData } from './global.js';

const projects = await fetchJSON('./lib/projects.json');
const latest = projects.slice(0, 3);

const projectsContainer = document.querySelector('.projects');
renderProjects(latest, projectsContainer, 'h2');

const profileStats = document.querySelector('#profile-stats');
if (profileStats) {
  try {
    const githubData = await fetchGitHubData('sohan-shingade');
    profileStats.innerHTML = `
      <dl>
        <dt>Public Repos</dt><dd>${githubData.public_repos}</dd>
        <dt>Public Gists</dt><dd>${githubData.public_gists}</dd>
        <dt>Followers</dt><dd>${githubData.followers}</dd>
        <dt>Following</dt><dd>${githubData.following}</dd>
      </dl>
    `;
  } catch (error) {
    profileStats.textContent = 'Could not load GitHub stats.';
  }
}
