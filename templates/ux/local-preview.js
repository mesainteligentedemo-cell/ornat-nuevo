/* Keep the original visual interface while making form behavior honest and local. */
(() => {
  document.addEventListener('submit', (event) => {
    const form = event.target.closest('form');
    if (!form) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!form.reportValidity()) return;
    let notice = form.querySelector('[data-local-notice]');
    if (!notice) {
      notice = document.createElement('p');
      notice.dataset.localNotice = '';
      notice.setAttribute('role', 'status');
      notice.style.cssText = 'font:inherit;font-size:14px;line-height:1.5;padding:12px 0;margin:8px 0;';
      form.appendChild(notice);
    }
    notice.textContent = 'Tu información aún no se ha enviado. Para solicitar una demo, llámanos al 984 235 3159 o visita ORNAT.COM.MX.';
  }, true);
})();
