

document.addEventListener('DOMContentLoaded', () => {
  markReady();
  setUpCtaInteraction();
});


function markReady() {
  document.documentElement.classList.add('is-ready');
}

function setUpCtaInteraction() {
  const cta = document.querySelector('[data-cta="write"]');
  if (!cta) return;

  cta.addEventListener('click', (event) => {
    if (cta.getAttribute('href') === '#') {
      event.preventDefault();
      cta.classList.add('is-pressed');
      window.setTimeout(() => cta.classList.remove('is-pressed'), 220);
    }
  });
}
