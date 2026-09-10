/**
 * Contact form: client-side validation, submit states, and a POST to
 * /api/contact. The server validates everything again — this side exists to
 * give fast, accessible feedback, not to be trusted.
 */

const ENDPOINT = '/api/contact';

const MESSAGES = {
  sending: 'Enviando…',
  success: 'Solicitud enviada. Gracias. Recibimos tu información y nos pondremos en contacto.',
  error: 'No pudimos enviar tu solicitud. Intentá nuevamente.',
};

/** Deliberately loose: enough to catch a typo, not to police valid addresses. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** CR numbers are 8 digits; allow +country code, spaces, dashes and parens. */
const PHONE_CHARS = /^[+\d\s().-]+$/;

const RULES = {
  nombre: (v) => (v.length >= 2 ? '' : 'Escribí tu nombre.'),
  email: (v) => (EMAIL.test(v) ? '' : 'Ingresá un correo válido.'),
  telefono: (v) => {
    const digits = v.replace(/\D/g, '');
    if (!PHONE_CHARS.test(v) || digits.length < 8 || digits.length > 15) {
      return 'Ingresá un teléfono válido.';
    }
    return '';
  },
  tipo: (v) => (v ? '' : 'Seleccioná una opción.'),
  mensaje: (v) => (v.length >= 10 ? '' : 'Contanos un poco sobre tu proyecto.'),
};

export function initContactForm() {
  const form = document.querySelector('[data-contact-form]');
  if (!form) return () => {};

  const button = form.querySelector('[data-submit]');
  const status = form.querySelector('[data-status]');
  const buttonLabel = button.textContent;
  let sending = false;

  function fieldOf(name) {
    return form.elements[name]?.closest('.field') ?? null;
  }

  function showError(name, message) {
    const control = form.elements[name];
    const field = fieldOf(name);
    const slot = field?.querySelector('.field__error');
    if (slot) slot.textContent = message;
    if (field) field.toggleAttribute('data-invalid', Boolean(message));
    control?.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  /** @returns {string[]} names of the fields that failed, in DOM order */
  function validate() {
    const failed = [];
    for (const [name, rule] of Object.entries(RULES)) {
      const value = (form.elements[name]?.value ?? '').trim();
      const message = rule(value);
      showError(name, message);
      if (message) failed.push(name);
    }
    return failed;
  }

  function setStatus(state, text) {
    if (!status) return;
    status.textContent = text;
    if (state) status.setAttribute('data-state', state);
    else status.removeAttribute('data-state');
  }

  // validate a field once it has been left, then keep it live while it is wrong
  const onBlur = (event) => {
    const name = event.target.name;
    if (!RULES[name]) return;
    showError(name, RULES[name](event.target.value.trim()));
  };

  const onInput = (event) => {
    const name = event.target.name;
    if (!RULES[name]) return;
    if (fieldOf(name)?.hasAttribute('data-invalid')) {
      showError(name, RULES[name](event.target.value.trim()));
    }
  };

  async function onSubmit(event) {
    event.preventDefault();
    if (sending) return; // no double submits

    const failed = validate();
    if (failed.length) {
      setStatus('error', 'Revisá los campos marcados.');
      form.elements[failed[0]]?.focus();
      return;
    }

    sending = true;
    button.disabled = true;
    button.textContent = MESSAGES.sending;
    setStatus(null, '');

    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      form.reset();
      validateReset();
      setStatus('success', MESSAGES.success);
    } catch (error) {
      console.warn('[contact]', error);
      setStatus('error', MESSAGES.error);
    } finally {
      sending = false;
      button.disabled = false;
      button.textContent = buttonLabel;
    }
  }

  function validateReset() {
    for (const name of Object.keys(RULES)) showError(name, '');
  }

  form.addEventListener('submit', onSubmit);
  form.addEventListener('blur', onBlur, true);
  form.addEventListener('input', onInput);

  return () => {
    form.removeEventListener('submit', onSubmit);
    form.removeEventListener('blur', onBlur, true);
    form.removeEventListener('input', onInput);
  };
}
