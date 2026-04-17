console.log('IT\u2019S ALIVE!');

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

const BASE_PATH =
  location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? '/'
    : '/dsc106-portfolio/';

const pages = [
  { url: '', title: 'Home' },
  { url: 'projects/', title: 'Projects' },
  { url: 'resume/', title: 'Resume' },
  { url: 'contact/', title: 'Contact' },
  { url: 'https://github.com/sohan-shingade', title: 'GitHub' },
];

const nav = document.createElement('nav');
document.body.prepend(nav);

for (const p of pages) {
  let url = p.url;
  if (!url.startsWith('http')) url = BASE_PATH + url;

  const a = document.createElement('a');
  a.href = url;
  a.textContent = p.title;

  a.classList.toggle(
    'current',
    a.host === location.host && a.pathname === location.pathname,
  );

  if (a.host !== location.host) {
    a.target = '_blank';
  }

  nav.append(a);
}

document.body.insertAdjacentHTML(
  'afterbegin',
  `
  <label class="color-scheme">
    Theme:
    <select>
      <option value="light dark">Automatic</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>
`,
);

const select = document.querySelector('.color-scheme select');

function setColorScheme(value) {
  document.documentElement.style.setProperty('color-scheme', value);
  select.value = value;
}

if ('colorScheme' in localStorage) {
  setColorScheme(localStorage.colorScheme);
} else {
  setColorScheme('light dark');
}

select.addEventListener('input', (event) => {
  const value = event.target.value;
  setColorScheme(value);
  localStorage.colorScheme = value;
});

const form = document.querySelector('form[data-contact]');
form?.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const params = [];
  for (const [name, value] of data) {
    params.push(`${name}=${encodeURIComponent(value)}`);
  }
  const url = `${form.action}?${params.join('&')}`;
  location.href = url;
});
