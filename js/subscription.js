// Step-by-step onboarding for the Sapphire City subscription form.
// Without JavaScript the full form still renders and submits as one page.
(function () {
  const form = document.getElementById('subscriptionForm');
  if (!form) return;

  const panel = document.getElementById('subscriber-form');
  const steps = [...form.querySelectorAll('.wizard-step')];
  const backBtn = document.getElementById('wizardBack');
  const nextBtn = document.getElementById('wizardNext');
  const submitBtn = document.getElementById('wizardSubmit');
  const status = document.getElementById('formStatus');
  const progress = document.getElementById('wizardProgress');
  const stepLabel = document.getElementById('wizardStepLabel');
  const timeLeft = document.getElementById('wizardTimeLeft');
  const bar = document.getElementById('wizardBar');
  const dots = document.getElementById('wizardDots');
  const restored = document.getElementById('wizardRestored');
  const success = document.getElementById('wizardSuccess');
  const sameAddress = document.getElementById('sameAddress');
  const DRAFT_KEY = 'sapphire-subscription-draft';
  const total = steps.length - 1; // the welcome step is not counted
  let current = 0;
  let lastMailto = '';

  form.noValidate = true;
  form.classList.add('wizard-on');
  progress.hidden = false;

  steps.forEach((step, i) => {
    const li = document.createElement('li');
    li.textContent = step.dataset.title;
    dots.appendChild(li);
    const legend = step.querySelector('legend');
    legend.tabIndex = -1;
    step.setAttribute('aria-label', step.dataset.title);
    if (i === 0) step.classList.add('is-active');
  });

  const controlsIn = (step) => [...step.querySelectorAll('input, select, textarea')].filter((el) => !el.disabled && el.id !== 'sameAddress');
  const firstName = () => (form.elements.other_names.value.trim().split(/\s+/)[0] || '').toLowerCase().replace(/^./, (c) => c.toUpperCase());

  function render(focus) {
    steps.forEach((step, i) => {
      step.classList.toggle('is-active', i === current);
      step.hidden = i !== current;
    });
    [...dots.children].forEach((li, i) => {
      li.classList.toggle('is-done', i < current);
      li.classList.toggle('is-current', i === current);
    });
    const isLast = current === steps.length - 1;
    backBtn.hidden = current === 0;
    nextBtn.hidden = isLast;
    submitBtn.hidden = !isLast;
    nextBtn.innerHTML = (current === 0 ? "Let's begin" : current === steps.length - 2 ? 'Review my answers' : 'Continue') + ' <span aria-hidden="true">→</span>';
    stepLabel.textContent = current === 0 ? 'Welcome' : 'Step ' + current + ' of ' + total + ' · ' + steps[current].dataset.title;
    const mins = Number(steps[current].dataset.minutes);
    timeLeft.textContent = isLast ? 'Final step!' : 'About ' + mins + ' min left';
    bar.style.width = Math.round((current / total) * 100) + '%';

    const name = firstName();
    form.querySelectorAll('[data-greet]').forEach((el) => { el.textContent = name ? 'Nice to meet you, ' + name + '!' : 'Great!'; });
    if (isLast) buildReview();
    status.textContent = '';

    if (focus) {
      panel.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      steps[current].querySelector('legend').focus({ preventScroll: true });
    }
  }

  // Validation: friendly inline messages instead of browser bubbles
  const NAME = /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .'-]*$/;
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const PHONE = /^\+?[\d\s()-]+$/;
  const today = new Date().toISOString().slice(0, 10);
  const nameRule = (label) => (v) => !NAME.test(v) ? label + ' can only contain letters, spaces, hyphens and apostrophes.' : v.length < 2 ? label + ' looks too short.' : '';
  const phoneRule = (v) => {
    const digits = v.replace(/\D/g, '').length;
    return !PHONE.test(v) || digits < 7 || digits > 15 ? 'Enter a valid phone number, e.g. 0803 123 4567 or +234 803 123 4567.' : '';
  };
  const emailRule = (v) => !EMAIL.test(v) ? 'Enter a valid email address, e.g. name@example.com.' : '';
  const age = (v) => {
    const dob = new Date(v), now = new Date();
    let years = now.getFullYear() - dob.getFullYear();
    if (now < new Date(now.getFullYear(), dob.getMonth(), dob.getDate())) years--;
    return years;
  };
  const rules = {
    title: (v) => !/^[A-Za-z .]{1,15}$/.test(v) ? 'Enter a title like Mr, Mrs, Ms, Dr or Chief.' : '',
    surname: nameRule('Surname'),
    other_names: nameRule('Other names'),
    document_name: nameRule('Name on document'),
    maiden_name: nameRule('Maiden name'),
    kin_name: nameRule('Next of kin name'),
    date_of_birth: (v) => v > today ? 'Date of birth cannot be in the future.' : age(v) < 18 ? 'You must be at least 18 years old to subscribe.' : age(v) > 120 ? 'Please check the year of birth.' : '',
    email: emailRule,
    kin_email: (v) => emailRule(v) || (v.toLowerCase() === form.elements.email.value.trim().toLowerCase() ? 'Next of kin email should be different from yours.' : ''),
    mobile: phoneRule,
    home_phone: phoneRule,
    work_phone: phoneRule,
    kin_mobile: (v) => phoneRule(v) || (v.replace(/\D/g, '') === form.elements.mobile.value.replace(/\D/g, '') ? 'Next of kin mobile should be different from yours.' : ''),
    plots: (v) => !/^\d+$/.test(v) || +v < 1 ? 'Enter a whole number of plots (1 or more).' : +v > 100 ? 'For more than 100 plots, please contact us directly.' : '',
    sqm: (v) => !/^\d+(\.\d+)?$/.test(v) || +v <= 0 ? 'Enter the size in square metres, e.g. 400.' : '',
    total_amount: (v) => { const n = Number(v.replace(/[₦,\s]/g, '')); return !isFinite(n) || n <= 0 ? 'Enter an amount in naira, e.g. 7,000,000.' : ''; },
    signature: (v) => nameRule('Signature')(v) || (v.trim().split(/\s+/).length < 2 ? 'Please type your full name (first and last name) as your signature.' : ''),
    signature_date: (v) => v > today ? 'The date cannot be in the future.' : '',
    passport_photo: (v, el) => {
      const file = el.files[0];
      if (!file) return '';
      if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) return 'Please choose a JPG, PNG or WEBP photo.';
      return file.size > 5 * 1024 * 1024 ? 'This photo is larger than 5 MB. Please choose a smaller one.' : '';
    }
  };
  const missing = {
    surname: 'Please enter your surname.',
    other_names: 'Please enter your other names.',
    document_name: 'Please enter the name you want on your title documents.',
    email: 'We need your email address to send your documents.',
    mobile: 'Please enter a mobile number we can reach you on.',
    payment_option: 'Please choose how you would like to pay.',
    signature: 'Please type your full name to sign.'
  };
  form.elements.date_of_birth.max = today;
  form.elements.signature_date.max = today;
  if (!form.elements.signature_date.value) form.elements.signature_date.value = today;

  function errorHost(el) {
    return el.type === 'radio' ? el.closest('.choice-cards') : el.closest('label');
  }
  function validateField(el, show) {
    if (el.type === 'checkbox' || (el.type === 'radio' && el !== form.elements[el.name][0])) return true;
    el.setCustomValidity('');
    const value = el.type === 'file' ? el.value : el.value.trim();
    let message = '';
    if (el.validity.valueMissing) message = missing[el.name] || 'This field is required.';
    else if (value && rules[el.name]) message = rules[el.name](value, el);
    else if (!el.checkValidity()) message = el.validationMessage;
    el.setCustomValidity(message);
    if (show) showError(el, message, value);
    return !message;
  }
  function showError(el, message, value) {
    const host = errorHost(el);
    const id = 'err-' + el.name;
    let box = document.getElementById(id);
    if (message && !box) {
      box = document.createElement('small');
      box.id = id;
      box.className = 'field-error';
      box.setAttribute('role', 'alert');
      if (el.type === 'radio') host.after(box); else host.appendChild(box);
    }
    if (box) { box.textContent = message; box.hidden = !message; }
    const targets = el.type === 'radio' ? [...form.elements[el.name]] : [el];
    targets.forEach((t) => {
      if (message) { t.setAttribute('aria-invalid', 'true'); t.setAttribute('aria-describedby', id); }
      else { t.removeAttribute('aria-invalid'); t.removeAttribute('aria-describedby'); }
    });
    host.classList.toggle('has-error', !!message);
    host.classList.toggle('is-valid', !message && !!value && el.type !== 'radio' && el.type !== 'file');
  }
  const validateAll = (els, show) => els.map((el) => validateField(el, show)).every(Boolean);

  form.addEventListener('focusout', (e) => { if (e.target.matches('.form-input, .form-select')) validateField(e.target, true); });
  form.addEventListener('input', (e) => {
    const el = e.target;
    if (el.closest('.has-error, .is-valid')) validateField(el, true);
    // keep dependent checks in sync
    if (el.name === 'email' && form.elements.kin_email.value) validateField(form.elements.kin_email, true);
    if (el.name === 'mobile' && form.elements.kin_mobile.value) validateField(form.elements.kin_mobile, true);
  });
  form.addEventListener('change', (e) => {
    const el = e.target;
    if (el.type === 'radio') validateField(form.elements[el.name][0], true);
    if (el.type === 'file' || el.tagName === 'SELECT') validateField(el, true);
  });
  // Tidy names into block letters as the form asks
  ['surname', 'other_names', 'document_name', 'maiden_name'].forEach((name) => {
    form.elements[name].addEventListener('blur', function () { this.value = this.value.trim().replace(/\s+/g, ' ').toUpperCase(); });
  });

  function stepIsValid(step) {
    const controls = controlsIn(step);
    if (validateAll(controls, true)) return true;
    const invalid = controls.find((el) => !el.checkValidity());
    invalid.focus();
    const count = step.querySelectorAll('.has-error').length;
    status.textContent = count > 1 ? 'Please fix the ' + count + ' highlighted fields to continue.' : 'Please fix the highlighted field to continue.';
    return false;
  }

  function goTo(index) {
    current = Math.max(0, Math.min(steps.length - 1, index));
    render(true);
  }

  function next() {
    if (!stepIsValid(steps[current])) return;
    saveDraft();
    goTo(current + 1);
  }

  backBtn.addEventListener('click', () => goTo(current - 1));
  nextBtn.addEventListener('click', next);

  // Mailing address shortcut
  const mailPairs = [['street', 'mail_street'], ['city', 'mail_city'], ['state', 'mail_state']];
  function syncMailing() {
    const mailing = document.getElementById('mailingFields');
    mailing.hidden = sameAddress.checked;
    if (sameAddress.checked) mailPairs.forEach(([from, to]) => { form.elements[to].value = form.elements[from].value; });
  }
  sameAddress.addEventListener('change', syncMailing);
  mailPairs.forEach(([from]) => form.elements[from].addEventListener('input', () => { if (sameAddress.checked) syncMailing(); }));

  // Review screen
  const reviewSections = [
    [1, 'About you', ['title', 'surname', 'other_names', 'document_name', 'date_of_birth', 'nationality', 'marital_status', 'maiden_name', 'religion']],
    [2, 'Address', ['street', 'city', 'state', 'country', 'mail_street', 'mail_city', 'mail_state']],
    [3, 'Contact', ['email', 'mobile', 'home_phone', 'kin_name', 'kin_mobile', 'kin_email']],
    [4, 'Work & ID', ['employer', 'work_phone', 'designation', 'work_street', 'work_city', 'work_state', 'work_country', 'identification']],
    [5, 'Your plans', ['purpose', 'develop_0_6', 'develop_6_12']],
    [6, 'Payment', ['payment_option', 'plots', 'sqm', 'payment_method', 'total_amount']]
  ];
  const labelFor = (name) => {
    const el = form.elements[name];
    const label = (el instanceof RadioNodeList ? el[0] : el).closest('label');
    if (name === 'identification' || name === 'purpose' || name === 'payment_option') return { identification: 'Identification', purpose: 'Purpose', payment_option: 'Payment option' }[name];
    return label.childNodes[0].textContent.replace('*', '').trim() || label.textContent.trim();
  };
  const checkedValues = (name) => [...form.querySelectorAll('[name="' + name + '"]:checked')].map((input) => input.value).join(', ');
  const valueOf = (name) => {
    if (name === 'develop_0_6') return form.elements[name].checked ? 'Build within 0–6 months' : '';
    if (name === 'develop_6_12') return form.elements[name].checked ? 'Build within 6–12 months' : '';
    if (name === 'identification' || name === 'purpose' || name === 'payment_option') return checkedValues(name);
    return form.elements[name].value.trim();
  };

  function buildReview() {
    const list = document.getElementById('reviewList');
    list.innerHTML = '';
    reviewSections.forEach(([stepIndex, title, names]) => {
      const card = document.createElement('div');
      card.className = 'review-card';
      const head = document.createElement('div');
      head.className = 'review-head';
      head.innerHTML = '<h3></h3><button type="button" class="link-button">Edit</button>';
      head.querySelector('h3').textContent = title;
      head.querySelector('button').addEventListener('click', () => goTo(stepIndex));
      card.appendChild(head);
      const dl = document.createElement('dl');
      names.forEach((name) => {
        const value = valueOf(name);
        if (!value) return;
        const label = name.startsWith('develop_') ? 'Timeline' : (name.startsWith('mail_') ? 'Mailing ' + labelFor(name).toLowerCase() : name.startsWith('work_') ? 'Work ' + labelFor(name).toLowerCase() : labelFor(name));
        const dt = document.createElement('dt'); dt.textContent = label;
        const dd = document.createElement('dd'); dd.textContent = value;
        dl.append(dt, dd);
      });
      if (!dl.children.length) {
        const empty = document.createElement('p'); empty.className = 'review-empty'; empty.textContent = 'Nothing added yet.';
        card.appendChild(empty);
      } else card.appendChild(dl);
      list.appendChild(card);
    });
  }

  // Draft autosave (per device only; the photo is never stored)
  function saveDraft() {
    try {
      const data = {};
      controlsIn(form).forEach((el) => {
        if (el.type === 'file') return;
        if (el.type === 'checkbox' || el.type === 'radio') { if (el.checked) (data[el.name] = data[el.name] || []).push(el.value); }
        else if (el.value) data[el.name] = el.value;
      });
      data._same = sameAddress.checked;
      data._step = current;
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    } catch (e) { /* storage unavailable */ }
  }
  function loadDraft() {
    let data;
    try { data = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) { return; }
    if (!data) return;
    controlsIn(form).forEach((el) => {
      if (el.type === 'file' || !(el.name in data)) return;
      if (el.type === 'checkbox' || el.type === 'radio') el.checked = [].concat(data[el.name]).includes(el.value);
      else el.value = data[el.name];
    });
    sameAddress.checked = !!data._same;
    syncMailing();
    current = Math.min(Number(data._step) || 0, steps.length - 1);
    restored.hidden = current === 0;
  }
  function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* storage unavailable */ } }
  form.addEventListener('change', saveDraft);
  document.getElementById('wizardReset').addEventListener('click', () => {
    clearDraft();
    form.reset();
    form.querySelectorAll('.has-error, .is-valid').forEach((el) => el.classList.remove('has-error', 'is-valid'));
    form.querySelectorAll('.field-error').forEach((el) => el.remove());
    form.querySelectorAll('[aria-invalid]').forEach((el) => { el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby'); });
    form.elements.signature_date.value = today;
    syncMailing();
    restored.hidden = true;
    goTo(0);
  });

  // Submit: Enter on earlier steps moves forward; the final step sends the email
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (current < steps.length - 1) { next(); return; }
    validateAll(controlsIn(form), false);
    const firstInvalidStep = steps.findIndex((step) => controlsIn(step).some((el) => !el.checkValidity()));
    if (firstInvalidStep !== -1) {
      const jumped = firstInvalidStep !== current;
      if (jumped) goTo(firstInvalidStep);
      stepIsValid(steps[firstInvalidStep]);
      if (jumped) status.textContent = 'Almost there — we brought you back to fix this step.';
      return;
    }
    const formData = new FormData(this);
    const lines = [];
    for (const [key, value] of formData.entries()) {
      if (key === 'passport_photo' || value instanceof File || value === 'on') continue;
      if (key === 'identification' || key === 'purpose') continue;
      if (value) lines.push(key.replaceAll('_', ' ') + ': ' + value);
    }
    for (const name of ['identification', 'purpose']) {
      const value = checkedValues(name);
      if (value) lines.push(name + ': ' + value);
    }
    for (const [name, label] of [['develop_0_6', 'Ready to develop in 0–6 months'], ['develop_6_12', 'Ready to develop in 6–12 months']]) {
      if (this.elements[name].checked) lines.push('Development timeline: ' + label);
    }
    const photo = formData.get('passport_photo');
    if (photo && photo.size) lines.push('Passport photo: Please attach the selected photo to this email.');
    lastMailto = 'mailto:info@gtextland.com?subject=' + encodeURIComponent('Sapphire City Gwagwalada Subscription Form') + '&body=' + encodeURIComponent(lines.join('\n'));

    clearDraft();
    const name = firstName();
    document.getElementById('successTitle').textContent = name ? 'Well done, ' + name + '! You\'re almost a landowner.' : 'You\'re almost a landowner!';
    form.hidden = true;
    progress.hidden = true;
    restored.hidden = true;
    success.hidden = false;
    success.focus();
    celebrate();
    window.location.href = lastMailto;
  });
  document.getElementById('successRetry').addEventListener('click', () => { if (lastMailto) window.location.href = lastMailto; });

  function celebrate() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['#d8b45f', '#193652', '#456a9d', '#e5c774', '#a47e32'];
    for (let i = 0; i < 70; i++) {
      const piece = document.createElement('span');
      piece.className = 'confetti';
      piece.style.left = Math.random() * 100 + '%';
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = Math.random() * 0.6 + 's';
      piece.style.animationDuration = 2 + Math.random() * 1.5 + 's';
      piece.style.transform = 'rotate(' + Math.random() * 360 + 'deg)';
      success.appendChild(piece);
      setTimeout(() => piece.remove(), 4500);
    }
  }

  loadDraft();
  render(false);
})();
