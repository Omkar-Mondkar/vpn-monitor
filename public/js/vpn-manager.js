/* ============================================================
   vpn-manager.js — Add / Edit / Delete modal logic + validation
   ============================================================ */

import { createVPN, updateVPN, deleteVPN } from './api.js';
import { showToast } from './toast.js';
import { validateIP, validatePort } from './utils.js';

let onChangeCallback = null;

/** Register a callback to be called when any VPN is created, updated, or deleted. */
export function onVPNChange(fn) {
  onChangeCallback = fn;
}

// ─── Modal state ──────────────────────────────────────────────
let editingVPN = null;

// ─── DOM refs (resolved lazily) ──────────────────────────────
const $ = id => document.getElementById(id);

// ─── Form / Modal helpers ────────────────────────────────────

function showModal(id) {
  $('modal-overlay').classList.add('visible');
  $(id).classList.add('visible');
}

function hideModal(id) {
  $(id).classList.remove('visible');
  $('modal-overlay').classList.remove('visible');
}

function clearErrors() {
  document.querySelectorAll('.form-input.error, .form-select.error').forEach(el => el.classList.remove('error'));
  document.querySelectorAll('.form-error-msg').forEach(el => el.classList.remove('visible'));
}

function showFieldError(fieldId, msg) {
  const input = $(fieldId);
  const err   = $(`${fieldId}-error`);
  if (input) { input.classList.add('error'); }
  if (err)   { err.textContent = msg; err.classList.add('visible'); }
}

function getFormData() {
  return {
    name:           $('f-name').value.trim(),
    protocol:       $('f-protocol').value,
    monitor_type:   $('f-monitor-type').value,
    source_ip:      $('f-source-ip').value.trim(),
    vpn_server_ip:  $('f-vpn-ip').value.trim(),
    destination_ip: $('f-dest-ip').value.trim(),
    port:           $('f-port').value.trim(),
    location:       $('f-location').value.trim(),
    description:    $('f-description').value.trim(),
  };
}

function populateForm(vpn) {
  $('f-name').value        = vpn.name || '';
  $('f-protocol').value    = vpn.protocol || 'WireGuard';
  $('f-monitor-type').value = vpn.monitor_type || 'end-to-end';
  $('f-source-ip').value   = vpn.source_ip || '';
  $('f-vpn-ip').value      = vpn.vpn_server_ip || '';
  $('f-dest-ip').value     = vpn.destination_ip || '';
  $('f-port').value        = vpn.port || '';
  $('f-location').value    = vpn.location || '';
  $('f-description').value = vpn.description || '';
  
  // Trigger visibility toggle
  $('f-monitor-type').dispatchEvent(new Event('change'));
}

function clearForm() {
  ['f-name','f-source-ip','f-vpn-ip','f-dest-ip','f-port','f-location','f-description'].forEach(id => {
    const el = $(id);
    if (el) el.value = '';
  });
  $('f-protocol').value = 'WireGuard';
  const typeSelect = $('f-monitor-type');
  if (typeSelect) {
    typeSelect.value = 'end-to-end';
    typeSelect.dispatchEvent(new Event('change'));
  }
  clearErrors();
}

function validateForm(data) {
  clearErrors();
  let valid = true;

  if (!data.name || data.name.length < 2) {
    showFieldError('f-name', 'Name must be at least 2 characters.');
    valid = false;
  }
  if (!validateIP(data.vpn_server_ip)) {
    showFieldError('f-vpn-ip', 'Enter a valid IP address.');
    valid = false;
  }
  
  if (data.monitor_type === 'end-to-end') {
    if (!validateIP(data.source_ip)) {
      showFieldError('f-source-ip', 'Enter a valid IP address.');
      valid = false;
    }
    if (!validateIP(data.destination_ip)) {
      showFieldError('f-dest-ip', 'Enter a valid IP address.');
      valid = false;
    }
  }

  if (data.monitor_type === 'end-to-end' || data.port) {
    if (!validatePort(data.port)) {
      showFieldError('f-port', 'Port must be between 1 and 65535.');
      valid = false;
    }
  }

  return valid;
}

// ─── Public API ───────────────────────────────────────────────

/** Open the Add VPN modal */
export function openAddModal() {
  editingVPN = null;
  clearForm();
  $('vpn-modal-title').textContent = '＋ Add VPN';
  $('vpn-modal-save').textContent  = 'Create VPN';
  showModal('vpn-modal');
  setTimeout(() => $('f-name')?.focus(), 50);
}

/** Open the Edit VPN modal pre-filled with `vpn` data */
export function openEditModal(vpn) {
  editingVPN = vpn;
  clearErrors();
  populateForm(vpn);
  $('vpn-modal-title').textContent = '✏️ Edit VPN';
  $('vpn-modal-save').textContent  = 'Save Changes';
  showModal('vpn-modal');
  setTimeout(() => $('f-name')?.focus(), 50);
}

/** Close the Add/Edit modal */
export function closeVPNModal() {
  hideModal('vpn-modal');
  editingVPN = null;
}

/** Open delete confirmation for `vpn` */
export function openDeleteModal(vpn) {
  $('delete-vpn-name').textContent = vpn.name;
  $('confirm-delete-btn').dataset.id = vpn.id;
  showModal('delete-modal');
}

/** Close the delete modal */
export function closeDeleteModal() {
  hideModal('delete-modal');
}

// ─── Event handlers ───────────────────────────────────────────

async function handleSave() {
  const data = getFormData();
  if (!validateForm(data)) return;

  const btn = $('vpn-modal-save');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Saving…';

  try {
    if (editingVPN) {
      const updated = await updateVPN(editingVPN.id, data);
      showToast('success', 'VPN Updated', `"${updated.name}" has been updated.`);
    } else {
      const created = await createVPN(data);
      showToast('success', 'VPN Created', `"${created.name}" has been added.`);
    }
    closeVPNModal();
    onChangeCallback?.();
  } catch (err) {
    // Errors already shown as toasts by api.js; show inline too if validation errors
    if (err.data?.errors) {
      err.data.errors.forEach(e => showToast('error', 'Validation', e));
    }
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

async function handleDelete(id) {
  const btn = $('confirm-delete-btn');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Deleting…';

  try {
    await deleteVPN(id);
    showToast('warning', 'VPN Deleted', 'The VPN entry has been removed.');
    closeDeleteModal();
    onChangeCallback?.();
  } catch {
    // Error toast handled by api.js
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

/** Bind all modal buttons and overlay. Call once after DOM is ready. */
export function initVPNManager() {
  // Add button (header)
  document.getElementById('add-vpn-btn')?.addEventListener('click', openAddModal);

  // Save
  $('vpn-modal-save')?.addEventListener('click', handleSave);

  // Cancel / Close
  $('vpn-modal-cancel')?.addEventListener('click', closeVPNModal);
  $('vpn-modal-close')?.addEventListener('click', closeVPNModal);

  // Delete confirm
  $('confirm-delete-btn')?.addEventListener('click', (e) => {
    handleDelete(e.currentTarget.dataset.id);
  });
  $('cancel-delete-btn')?.addEventListener('click', closeDeleteModal);
  $('delete-modal-close')?.addEventListener('click', closeDeleteModal);

  // Overlay click closes any open modal
  $('modal-overlay')?.addEventListener('click', () => {
    closeVPNModal();
    closeDeleteModal();
  });

  // Stop clicks inside modals from propagating to overlay
  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', e => e.stopPropagation());
  });

  // Global keyboard: Esc closes modals, N opens add
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeVPNModal(); closeDeleteModal(); }
    if (e.key === 'n' && !e.ctrlKey && !e.metaKey) {
      const focused = document.activeElement;
      if (!['INPUT','TEXTAREA','SELECT'].includes(focused.tagName)) {
        openAddModal();
      }
    }
  });

  // Dynamic form visibility
  function updateDynamicFields() {
    const type = $('f-monitor-type')?.value;
    const port = $('f-port')?.value.trim();
    const fields = $('end-to-end-fields');
    const asterisk = $('f-port-asterisk');
    const helper = $('f-port-helper');

    if (fields) {
      fields.style.display = type === 'infrastructure' ? 'none' : 'block';
    }

    if (asterisk && helper) {
      if (type === 'end-to-end') {
        asterisk.style.display = 'inline';
        helper.style.display = 'none';
      } else {
        asterisk.style.display = 'none';
        helper.style.display = 'block';
        if (port) {
          helper.textContent = '🔌 Service Probing (Checking if VPN daemon is listening)';
        } else {
          helper.textContent = '📡 ICMP Ping (Checking if physical server is online)';
        }
      }
    }
  }

  $('f-monitor-type')?.addEventListener('change', updateDynamicFields);
  $('f-port')?.addEventListener('input', updateDynamicFields);
}
