// State Management
let state = {
    purchases: [],
    sales: [],
    workers: [],
    pendingRequests: [],
    categories: [],
    auditLogs: [],
    masterItems: []
};

// Performance: cached formatter & debounce utility
const _currencyFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
function debounce(fn, ms) {
    let t;
    return function(...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
}

// Temporary storage for purchase being confirmed
let pendingPurchaseData = null;

// Initial Setup & Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initNavigation();
    initEventListeners();
    updateDashboard();
    renderPurchasesTable();
    renderSalesTable();
    populateBrandSuggestions();
    
    // Seed initial values for Admin Panel if not present
    seedAdminInitialData();
    refreshAdminPanel();
});

// Load data from LocalStorage
function loadData() {
    const localPurchases = localStorage.getItem('aura_pos_purchases');
    const localSales = localStorage.getItem('aura_pos_sales');
    const localWorkers = localStorage.getItem('aura_pos_workers');
    const localPending = localStorage.getItem('aura_pos_pending');
    const localCategories = localStorage.getItem('aura_pos_categories');
    const localLogs = localStorage.getItem('aura_pos_logs');
    const localMasterItems = localStorage.getItem('aura_pos_master_items');
    
    state.purchases = localPurchases ? JSON.parse(localPurchases) : [];
    state.sales = localSales ? JSON.parse(localSales) : [];
    state.workers = localWorkers ? JSON.parse(localWorkers) : [];
    state.pendingRequests = localPending ? JSON.parse(localPending) : [];
    state.categories = localCategories ? JSON.parse(localCategories) : [];
    state.auditLogs = localLogs ? JSON.parse(localLogs) : [];
    state.masterItems = localMasterItems ? JSON.parse(localMasterItems) : [];
}

// Save data to LocalStorage
// Batched save — avoids redundant re-renders; callers update UI themselves
let _saveQueued = false;
function saveData() {
    if (_saveQueued) return;
    _saveQueued = true;
    requestAnimationFrame(() => {
        localStorage.setItem('aura_pos_purchases', JSON.stringify(state.purchases));
        localStorage.setItem('aura_pos_sales', JSON.stringify(state.sales));
        localStorage.setItem('aura_pos_workers', JSON.stringify(state.workers));
        localStorage.setItem('aura_pos_pending', JSON.stringify(state.pendingRequests));
        localStorage.setItem('aura_pos_categories', JSON.stringify(state.categories));
        localStorage.setItem('aura_pos_logs', JSON.stringify(state.auditLogs));
        localStorage.setItem('aura_pos_master_items', JSON.stringify(state.masterItems));
        _saveQueued = false;
    });
    // Lightweight refresh — only active section
    const activeNav = document.querySelector('.nav-item.active');
    const target = activeNav ? activeNav.getAttribute('data-target') : '';
    if (target === 'dashboard-section') updateDashboard();
    else if (target === 'purchases-section') renderPurchasesTable();
    else if (target === 'sales-section') renderSalesTable();
    else if (target === 'admin-section') refreshAdminPanel();
    populateBrandSuggestions();
}

// Navigation Handling
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.page-section');
    const sectionTitle = document.getElementById('section-title');
    const sectionSubtitle = document.getElementById('section-subtitle');
    const quickActionBtn = document.getElementById('quick-action-btn');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.getAttribute('data-target');
            
            // Toggle active menu item
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            // Toggle active page section
            sections.forEach(sec => {
                if (sec.id === target) {
                    sec.classList.add('active');
                } else {
                    sec.classList.remove('active');
                }
            });

            // Adjust header based on section
            if (target === 'dashboard-section') {
                sectionTitle.textContent = 'Dashboard Overview';
                sectionSubtitle.textContent = 'Real-time statistics & summary of ledger activities.';
                quickActionBtn.style.display = 'inline-flex';
                quickActionBtn.className = 'btn btn-primary';
                quickActionBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> New Purchase`;
                quickActionBtn.onclick = () => openModal('purchase-modal');
                updateDashboard();
            } else if (target === 'purchases-section') {
                sectionTitle.textContent = 'Purchases Register';
                sectionSubtitle.textContent = 'Ledger for tracking acquisitions, brands, and cheque payments.';
                quickActionBtn.style.display = 'inline-flex';
                quickActionBtn.className = 'btn btn-primary';
                quickActionBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Add Purchase`;
                quickActionBtn.onclick = () => openModal('purchase-modal');
                renderPurchasesTable();
            } else if (target === 'sales-section') {
                sectionTitle.textContent = 'Sales Register';
                sectionSubtitle.textContent = 'Track client order invoices, customer information, and balances.';
                quickActionBtn.style.display = 'inline-flex';
                quickActionBtn.className = 'btn btn-success';
                quickActionBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Add Sale`;
                quickActionBtn.onclick = () => openModal('sale-modal');
                renderSalesTable();
            } else if (target === 'data-section') {
                sectionTitle.textContent = 'Database Settings';
                sectionSubtitle.textContent = 'Export files, import backups, seed test environments, or clear memory.';
                quickActionBtn.style.display = 'none';
            } else if (target === 'admin-section') {
                sectionTitle.textContent = 'Admin Control Panel';
                sectionSubtitle.textContent = 'Manage workers, configure categories, audit action logs, and system preferences.';
                quickActionBtn.style.display = 'none';
                refreshAdminPanel();
            }


            // Close sidebar on mobile
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.remove('open');
        });
    });

    // Default quick action mapping
    quickActionBtn.onclick = () => openModal('purchase-modal');

    // Sidebar Hamburger Toggle for Responsive view
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    menuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        sidebar.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
        if (!sidebar.contains(e.target) && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
        }
    });
}

// Modal open/close helpers
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    
    // Form cleanses
    if (modalId === 'purchase-modal') {
        document.getElementById('purchase-form').reset();
        document.getElementById('purchase-edit-id').value = '';
        document.getElementById('cheque-details-section').classList.remove('show');
        document.getElementById('purchase-modal-title').textContent = 'Log Brand Purchase';
    } else if (modalId === 'sale-modal') {
        document.getElementById('sale-form').reset();
        document.getElementById('sale-edit-id').value = '';
        document.getElementById('items-rows-container').innerHTML = '';
        document.getElementById('sale-partial-amount-group').style.display = 'none';
        document.getElementById('sale-balance-display').textContent = '₹0.00';
        document.getElementById('sale-balance-display').style.color = 'var(--accent-success)';
        document.getElementById('sale-modal-title').textContent = 'Record Customer Sale';
        // Add one initial empty item row
        addSalesLineItem();
    } else if (modalId === 'confirm-cheque-modal') {
        document.getElementById('double-confirm-checkbox').checked = false;
        document.getElementById('confirm-cheque-approve').disabled = true;
        pendingPurchaseData = null;
    }
}

// Set up UI Event Listeners
function initEventListeners() {
    // Modal Close Triggers
    document.querySelectorAll('.modal-close, button[data-modal]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modalId = btn.getAttribute('data-modal');
            closeModal(modalId);
        });
    });

    // Add Purchase trigger
    document.getElementById('add-purchase-btn').addEventListener('click', () => {
        openModal('purchase-modal');
    });

    // Purchase Cheque toggle details display
    document.getElementById('purchase-cheque-toggle').addEventListener('change', (e) => {
        const chequeSec = document.getElementById('cheque-details-section');
        const chqNo = document.getElementById('purchase-cheque-no');
        const chqDate = document.getElementById('purchase-cheque-date');

        if (e.target.checked) {
            chequeSec.classList.add('show');
            chqNo.required = true;
            chqDate.required = true;
        } else {
            chequeSec.classList.remove('show');
            chqNo.required = false;
            chqDate.required = false;
            chqNo.value = '';
            chqDate.value = '';
        }
    });

    // Purchase form submit handler
    document.getElementById('purchase-form').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const id = document.getElementById('purchase-edit-id').value;
        const invoice = document.getElementById('purchase-invoice').value.trim();
        const brand = document.getElementById('purchase-brand').value.trim();
        const date = document.getElementById('purchase-date').value;
        const amount = parseFloat(document.getElementById('purchase-amount').value);
        const chequePaid = document.getElementById('purchase-cheque-toggle').checked;
        const chequeNo = document.getElementById('purchase-cheque-no').value.trim();
        const chequeDate = document.getElementById('purchase-cheque-date').value;
        const remark = document.getElementById('purchase-remark').value.trim();

        const purchaseRecord = {
            id: id || 'pur_' + Date.now(),
            invoice,
            brand,
            date,
            amount,
            chequePaid,
            chequeNo: chequePaid ? chequeNo : '',
            chequeDate: chequePaid ? chequeDate : '',
            remark
        };

        if (chequePaid) {
            // Trigger double confirmation modal
            pendingPurchaseData = purchaseRecord;
            document.getElementById('confirm-brand-name').textContent = brand;
            document.getElementById('confirm-invoice-no').textContent = invoice;
            document.getElementById('confirm-total-amount').textContent = formatCurrency(amount);
            document.getElementById('confirm-cheque-no').textContent = chequeNo;
            document.getElementById('confirm-cheque-date').textContent = formatDate(chequeDate);
            
            openModal('confirm-cheque-modal');
        } else {
            // Standard save
            savePurchase(purchaseRecord);
        }
    });

    // Double confirmation cheque controls
    const doubleConfirmCheck = document.getElementById('double-confirm-checkbox');
    const approveBtn = document.getElementById('confirm-cheque-approve');
    const chqCancelBtn = document.getElementById('confirm-cheque-cancel');

    doubleConfirmCheck.addEventListener('change', (e) => {
        approveBtn.disabled = !e.target.checked;
    });

    approveBtn.addEventListener('click', () => {
        if (pendingPurchaseData && doubleConfirmCheck.checked) {
            savePurchase(pendingPurchaseData);
            closeModal('confirm-cheque-modal');
            closeModal('purchase-modal');
        }
    });

    chqCancelBtn.addEventListener('click', () => {
        closeModal('confirm-cheque-modal');
    });

    // Add Sales trigger
    document.getElementById('add-sale-btn').addEventListener('click', () => {
        openModal('sale-modal');
    });

    // Add line item click
    document.getElementById('add-line-item-btn').addEventListener('click', () => {
        addSalesLineItem();
    });

    // Sales payment status selection change
    const salePaymentType = document.getElementById('sale-payment-type');
    const partialAmountGrp = document.getElementById('sale-partial-amount-group');
    const paidInput = document.getElementById('sale-paid-amount');

    salePaymentType.addEventListener('change', () => {
        if (salePaymentType.value === 'partial') {
            partialAmountGrp.style.display = 'flex';
            paidInput.required = true;
            paidInput.min = "0.01";
        } else {
            partialAmountGrp.style.display = 'none';
            paidInput.required = false;
            paidInput.value = '';
        }
        recalculateSalesTotals();
    });

    paidInput.addEventListener('input', recalculateSalesTotals);

    // Sales form submit handler
    document.getElementById('sale-form').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const id = document.getElementById('sale-edit-id').value;
        const invoice = document.getElementById('sale-invoice').value.trim();
        const date = document.getElementById('sale-date').value;
        const paymentType = document.getElementById('sale-payment-type').value;
        const remark = document.getElementById('sale-remark').value.trim();

        // Collect item details
        const rows = document.querySelectorAll('.item-row-entry');
        const items = [];
        
        rows.forEach(row => {
            const name = row.querySelector('.item-name').value.trim();
            const qty = parseInt(row.querySelector('.item-qty').value) || 0;
            const price = parseFloat(row.querySelector('.item-price').value) || 0;
            
            if (name && qty > 0 && price > 0) {
                items.push({ name, qty, price });
            }
        });

        if (items.length === 0) {
            alert('Please add at least one valid item with positive quantity and unit price.');
            return;
        }

        const total = items.reduce((sum, item) => sum + (item.qty * item.price), 0);
        let paidAmount = 0;
        let balance = 0;

        if (paymentType === 'paid-now') {
            paidAmount = total;
            balance = 0;
        } else if (paymentType === 'paid-later') {
            paidAmount = 0;
            balance = total;
        } else if (paymentType === 'partial') {
            paidAmount = parseFloat(document.getElementById('sale-paid-amount').value) || 0;
            if (paidAmount > total) {
                alert('Amount paid now cannot exceed the total invoice amount.');
                return;
            }
            balance = total - paidAmount;
        }

        const saleRecord = {
            id: id || 'sale_' + Date.now(),
            invoice,
            date,
            items,
            paymentType,
            paidAmount,
            balance,
            remark
        };

        saveSale(saleRecord);
    });

    // Filters & Searches
    // Debounced search inputs for performance
    document.getElementById('purchase-search').addEventListener('input', debounce(renderPurchasesTable, 200));
    document.getElementById('purchase-filter-cheque').addEventListener('change', renderPurchasesTable);
    document.getElementById('sales-search').addEventListener('input', debounce(renderSalesTable, 200));
    document.getElementById('sales-filter-balance').addEventListener('change', renderSalesTable);

    // Chart Timeframe Change
    document.getElementById('chart-timeframe').addEventListener('change', renderChart);

    // Data settings listeners
    document.getElementById('export-purchases-csv').addEventListener('click', () => exportCSV('purchases'));
    document.getElementById('export-sales-csv').addEventListener('click', () => exportCSV('sales'));
    document.getElementById('quick-export-btn').addEventListener('click', () => exportCSV('sales'));
    document.getElementById('export-json-backup').addEventListener('click', exportJSON);
    
    const jsonFileInput = document.getElementById('import-json-file');
    const importTriggerBtn = document.getElementById('import-trigger-btn');
    const importFileName = document.getElementById('import-file-name');

    importTriggerBtn.addEventListener('click', () => {
        jsonFileInput.click();
    });

    jsonFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            importFileName.textContent = file.name;
            importJSONFile(file);
        }
    });

    document.getElementById('seed-demo-data').addEventListener('click', seedDemoDatabase);
    document.getElementById('clear-database-btn').addEventListener('click', clearDatabase);

    // Admin Panel sub-tabs navigation toggle
    const subtabs = document.querySelectorAll('.admin-subtab');
    const panels = document.querySelectorAll('.admin-panel-content');
    subtabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.getAttribute('data-subtab');
            
            subtabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            panels.forEach(p => {
                if (p.id === targetTab + '-content') {
                    p.classList.add('active');
                } else {
                    p.classList.remove('active');
                }
            });
            refreshAdminPanel();
        });
    });

    // Add Worker Account Submission
    document.getElementById('add-worker-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('worker-email').value.trim();
        const password = document.getElementById('worker-password').value;
        
        if (state.workers.some(w => w.email.toLowerCase() === email.toLowerCase())) {
            alert('A worker with this email address already exists.');
            return;
        }
        
        const newWorker = {
            id: 'wk_' + Date.now(),
            email,
            role: 'Worker',
            password,
            joined: new Date().toISOString().split('T')[0]
        };
        
        state.workers.push(newWorker);
        logAuditEvent(`Created worker account: ${email}`, 'create');
        saveData();
        
        document.getElementById('add-worker-form').reset();
    });

    // Toggle password visibility winking icon logic
    document.getElementById('worker-password-toggle').addEventListener('click', () => {
        const pwdInput = document.getElementById('worker-password');
        const icon = document.querySelector('#worker-password-toggle svg');
        if (pwdInput.type === 'password') {
            pwdInput.type = 'text';
            icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/><path d="M2 2l20 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
        } else {
            pwdInput.type = 'password';
            icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
        }
    });

    // Create Master Item Form Handler
    document.getElementById('admin-add-item-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('admin-item-name').value.trim();
        const price = parseFloat(document.getElementById('admin-item-price').value);
        
        if (state.masterItems.some(item => item.name.toLowerCase() === name.toLowerCase())) {
            alert('An item with this name already exists in the master catalog.');
            return;
        }
        
        state.masterItems.push({ name, price });
        logAuditEvent(`Added master item catalog: ${name} (₹${price.toFixed(2)})`, 'create');
        saveData();
        document.getElementById('admin-add-item-form').reset();
    });

    // Add Product Category Form Handler
    document.getElementById('admin-add-category-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('admin-category-name').value.trim();
        
        if (state.categories.some(c => c.toLowerCase() === name.toLowerCase())) {
            alert('This category already exists.');
            return;
        }
        
        state.categories.push(name);
        logAuditEvent(`Created product category: ${name}`, 'create');
        saveData();
        document.getElementById('admin-add-category-form').reset();
    });

    // Purge Logs Action
    document.getElementById('clear-logs-btn').addEventListener('click', () => {
        if (confirm('Are you sure you want to purge all action audit logs?')) {
            state.auditLogs = [];
            saveData();
        }
    });

    // Logout Button Action Simulation
    document.getElementById('logout-btn').addEventListener('click', () => {
        alert('Logout simulation: Session ended. You will now be redirected to the dashboard.');
        const dashboardTab = document.querySelector('[data-target="dashboard-section"]');
        if (dashboardTab) dashboardTab.click();
    });

    // Update Master Title/Role credentials settings
    document.getElementById('save-security-settings-btn').addEventListener('click', () => {
        const newRole = document.getElementById('admin-role-input').value.trim();
        if (newRole) {
            document.querySelector('.client-role').textContent = newRole;
            logAuditEvent(`Admin role configuration updated to: ${newRole}`, 'system');
            alert('Security configurations successfully updated.');
        }
    });
}

// Save Purchase operation helper
function savePurchase(purchase) {
    const existingIndex = state.purchases.findIndex(p => p.id === purchase.id);
    if (existingIndex > -1) {
        state.purchases[existingIndex] = purchase;
    } else {
        state.purchases.push(purchase);
    }
    
    saveData();
    closeModal('purchase-modal');
    renderPurchasesTable();
}

// Edit Purchase
function editPurchase(id) {
    const purchase = state.purchases.find(p => p.id === id);
    if (!purchase) return;

    document.getElementById('purchase-edit-id').value = purchase.id;
    document.getElementById('purchase-invoice').value = purchase.invoice;
    document.getElementById('purchase-brand').value = purchase.brand;
    document.getElementById('purchase-date').value = purchase.date;
    document.getElementById('purchase-amount').value = purchase.amount;
    document.getElementById('purchase-remark').value = purchase.remark;

    const chequeToggle = document.getElementById('purchase-cheque-toggle');
    const chequeSec = document.getElementById('cheque-details-section');

    if (purchase.chequePaid) {
        chequeToggle.checked = true;
        chequeSec.classList.add('show');
        document.getElementById('purchase-cheque-no').value = purchase.chequeNo;
        document.getElementById('purchase-cheque-date').value = purchase.chequeDate;
        document.getElementById('purchase-cheque-no').required = true;
        document.getElementById('purchase-cheque-date').required = true;
    } else {
        chequeToggle.checked = false;
        chequeSec.classList.remove('show');
        document.getElementById('purchase-cheque-no').value = '';
        document.getElementById('purchase-cheque-date').value = '';
        document.getElementById('purchase-cheque-no').required = false;
        document.getElementById('purchase-cheque-date').required = false;
    }

    document.getElementById('purchase-modal-title').textContent = 'Modify Brand Purchase';
    openModal('purchase-modal');
}

// Delete Purchase
function deletePurchase(id) {
    if (confirm('Are you sure you want to permanently delete this purchase ledger record?')) {
        state.purchases = state.purchases.filter(p => p.id !== id);
        saveData();
        renderPurchasesTable();
    }
}

// Save Sale operation helper
function saveSale(sale) {
    const existingIndex = state.sales.findIndex(s => s.id === sale.id);
    if (existingIndex > -1) {
        state.sales[existingIndex] = sale;
    } else {
        state.sales.push(sale);
    }
    
    saveData();
    closeModal('sale-modal');
    renderSalesTable();
}

// Edit Sale
function editSale(id) {
    const sale = state.sales.find(s => s.id === id);
    if (!sale) return;

    document.getElementById('sale-edit-id').value = sale.id;
    document.getElementById('sale-invoice').value = sale.invoice;
    document.getElementById('sale-date').value = sale.date;
    document.getElementById('sale-payment-type').value = sale.paymentType;
    document.getElementById('sale-remark').value = sale.remark;

    const itemsContainer = document.getElementById('items-rows-container');
    itemsContainer.innerHTML = '';
    
    sale.items.forEach(item => {
        addSalesLineItem(item.name, item.qty, item.price);
    });

    const partialAmountGrp = document.getElementById('sale-partial-amount-group');
    const paidInput = document.getElementById('sale-paid-amount');

    if (sale.paymentType === 'partial') {
        partialAmountGrp.style.display = 'flex';
        paidInput.value = sale.paidAmount;
        paidInput.required = true;
    } else {
        partialAmountGrp.style.display = 'none';
        paidInput.value = '';
        paidInput.required = false;
    }

    document.getElementById('sale-modal-title').textContent = 'Modify Customer Sale';
    recalculateSalesTotals();
    openModal('sale-modal');
}

// Delete Sale
function deleteSale(id) {
    if (confirm('Are you sure you want to permanently delete this customer sale record?')) {
        state.sales = state.sales.filter(s => s.id !== id);
        saveData();
        renderSalesTable();
    }
}

// Render Purchases Table view
function renderPurchasesTable() {
    const tbody = document.getElementById('purchases-tbody');
    const emptyState = document.getElementById('purchases-empty-state');
    const query = document.getElementById('purchase-search').value.toLowerCase();
    const filterCheque = document.getElementById('purchase-filter-cheque').value;
    
    tbody.innerHTML = '';
    
    // Sort transactions latest first
    const filtered = state.purchases.filter(p => {
        const matchesQuery = p.brand.toLowerCase().includes(query) || p.invoice.toLowerCase().includes(query);
        let matchesFilter = true;
        if (filterCheque === 'cheque-paid') matchesFilter = p.chequePaid;
        if (filterCheque === 'not-paid') matchesFilter = !p.chequePaid;
        
        return matchesQuery && matchesFilter;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    if (filtered.length === 0) {
        emptyState.style.display = 'flex';
        return;
    }
    
    emptyState.style.display = 'none';

    filtered.forEach(p => {
        const tr = document.createElement('tr');
        
        let chequeBadgeHtml = '';
        if (p.chequePaid) {
            chequeBadgeHtml = `
                <div style="display: flex; flex-direction: column; gap: 2px;">
                    <span class="badge badge-paid">Cheque Issued</span>
                    <span style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">No: ${p.chequeNo}</span>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">Due: ${formatDate(p.chequeDate)}</span>
                </div>
            `;
        } else {
            chequeBadgeHtml = `<span class="badge badge-unpaid">Cash / Open</span>`;
        }

        tr.innerHTML = `
            <td style="font-weight: 600; font-family: monospace;">${escapeHTML(p.invoice)}</td>
            <td style="font-weight: 600; color: #a855f7;">${escapeHTML(p.brand)}</td>
            <td>${formatDate(p.date)}</td>
            <td style="font-weight: 700;">${formatCurrency(p.amount)}</td>
            <td>${chequeBadgeHtml}</td>
            <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.85rem;" title="${escapeHTML(p.remark)}">
                ${escapeHTML(p.remark || '-')}
            </td>
            <td style="text-align: right;">
                <div class="row-actions" style="justify-content: flex-end;">
                    <button class="action-btn edit" onclick="editPurchase('${p.id}')" title="Edit Purchase">
                        <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"/></svg>
                    </button>
                    <button class="action-btn delete" onclick="deletePurchase('${p.id}')" title="Delete Purchase">
                        <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Render Sales Table view
function renderSalesTable() {
    const tbody = document.getElementById('sales-tbody');
    const emptyState = document.getElementById('sales-empty-state');
    const query = document.getElementById('sales-search').value.toLowerCase();
    const filterBalance = document.getElementById('sales-filter-balance').value;

    tbody.innerHTML = '';

    const filtered = state.sales.filter(s => {
        const itemNamesStr = s.items.map(i => i.name).join(', ').toLowerCase();
        const matchesQuery = s.invoice.toLowerCase().includes(query) || 
                             s.remark.toLowerCase().includes(query) || 
                             itemNamesStr.includes(query);
                             
        let matchesFilter = true;
        if (filterBalance === 'paid-now') matchesFilter = s.balance === 0;
        if (filterBalance === 'paid-later') matchesFilter = s.balance > 0;

        return matchesQuery && matchesFilter;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    if (filtered.length === 0) {
        emptyState.style.display = 'flex';
        return;
    }

    emptyState.style.display = 'none';

    filtered.forEach(s => {
        const tr = document.createElement('tr');
        const totalAmount = s.items.reduce((sum, i) => sum + (i.qty * i.price), 0);

        // Generate clean bullet breakdown of items
        const itemsDetailsHtml = s.items.map(i => 
            `<div style="font-size: 0.85rem;"><span style="color: var(--text-muted);">${i.qty}x</span> ${escapeHTML(i.name)} <span style="color: var(--text-muted);">@ ${formatCurrency(i.price)}</span></div>`
        ).join('');

        let statusBadgeHtml = '';
        if (s.paymentType === 'paid-now') {
            statusBadgeHtml = `<span class="badge badge-paid">Paid Now</span>`;
        } else if (s.paymentType === 'paid-later') {
            statusBadgeHtml = `<span class="badge badge-unpaid">Paid Later</span>`;
        } else {
            statusBadgeHtml = `
                <div style="display: flex; flex-direction: column; gap: 2px;">
                    <span class="badge badge-pending">Partial Payment</span>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">Rec'd: ${formatCurrency(s.paidAmount)}</span>
                </div>
            `;
        }

        const balanceHtml = s.balance > 0 
            ? `<span style="font-weight: 700; color: var(--accent-danger);">${formatCurrency(s.balance)}</span>`
            : `<span style="color: var(--accent-success); font-weight: 600;">$0.00</span>`;

        tr.innerHTML = `
            <td style="font-weight: 600; font-family: monospace;">${escapeHTML(s.invoice)}</td>
            <td>${formatDate(s.date)}</td>
            <td><div style="display: flex; flex-direction: column; gap: 4px;">${itemsDetailsHtml}</div></td>
            <td style="font-weight: 700;">${formatCurrency(totalAmount)}</td>
            <td>${statusBadgeHtml}</td>
            <td>${balanceHtml}</td>
            <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.85rem;" title="${escapeHTML(s.remark)}">
                ${escapeHTML(s.remark || '-')}
            </td>
            <td style="text-align: right;">
                <div class="row-actions" style="justify-content: flex-end;">
                    <button class="action-btn edit" onclick="editSale('${s.id}')" title="Edit Customer Sale">
                        <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"/></svg>
                    </button>
                    <button class="action-btn delete" onclick="deleteSale('${s.id}')" title="Delete Customer Sale">
                        <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Add Sale Dynamic Line Item Row
function addSalesLineItem(name = '', qty = 1, price = '') {
    const container = document.getElementById('items-rows-container');
    const rowId = 'row_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    
    const rowDiv = document.createElement('div');
    rowDiv.className = 'item-row-entry';
    rowDiv.id = rowId;
    
    rowDiv.innerHTML = `
        <input type="text" class="form-input item-name" placeholder="Item/Service name" value="${escapeHTML(name)}" required>
        <input type="number" class="form-input item-qty" min="1" step="1" placeholder="1" value="${qty}" style="text-align: center;" required>
        <input type="number" class="form-input item-price" min="0.01" step="0.01" placeholder="0.00" value="${price}" style="text-align: right;" required>
        <span class="item-total-display">₹0.00</span>
        <button type="button" class="action-btn delete btn-icon-only remove-item-btn" style="color: var(--accent-danger);" title="Remove line item">
            <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
    `;

    container.appendChild(rowDiv);

    // Event hooks for inline computations
    const qtyInput = rowDiv.querySelector('.item-qty');
    const priceInput = rowDiv.querySelector('.item-price');
    const removeBtn = rowDiv.querySelector('.remove-item-btn');

    const computeRowTotal = () => {
        const q = parseInt(qtyInput.value) || 0;
        const p = parseFloat(priceInput.value) || 0;
        const rowTotal = q * p;
        rowDiv.querySelector('.item-total-display').textContent = formatCurrency(rowTotal);
        recalculateSalesTotals();
    };

    qtyInput.addEventListener('input', computeRowTotal);
    priceInput.addEventListener('input', computeRowTotal);
    
    removeBtn.addEventListener('click', () => {
        // Guarantee at least 1 item stays active
        if (container.querySelectorAll('.item-row-entry').length > 1) {
            rowDiv.remove();
            recalculateSalesTotals();
        } else {
            alert('An invoice must contain at least one product or service line item.');
        }
    });

    // Run first calculation
    if (price !== '') computeRowTotal();
}

// Recalculate Sales Forms Summary Totals
function recalculateSalesTotals() {
    const rows = document.querySelectorAll('.item-row-entry');
    let grandTotal = 0;
    
    rows.forEach(row => {
        const qty = parseInt(row.querySelector('.item-qty').value) || 0;
        const price = parseFloat(row.querySelector('.item-price').value) || 0;
        grandTotal += qty * price;
    });

    document.getElementById('invoice-total-display').textContent = formatCurrency(grandTotal);

    const paymentType = document.getElementById('sale-payment-type').value;
    const paidInput = document.getElementById('sale-paid-amount');
    const balanceDisplay = document.getElementById('sale-balance-display');
    
    let balance = 0;

    if (paymentType === 'paid-now') {
        balance = 0;
        balanceDisplay.textContent = formatCurrency(0);
        balanceDisplay.style.color = 'var(--accent-success)';
    } else if (paymentType === 'paid-later') {
        balance = grandTotal;
        balanceDisplay.textContent = formatCurrency(grandTotal);
        balanceDisplay.style.color = 'var(--accent-danger)';
    } else if (paymentType === 'partial') {
        const paidAmount = parseFloat(paidInput.value) || 0;
        balance = Math.max(0, grandTotal - paidAmount);
        balanceDisplay.textContent = formatCurrency(balance);
        
        if (balance === 0) {
            balanceDisplay.style.color = 'var(--accent-success)';
        } else {
            balanceDisplay.style.color = 'var(--accent-danger)';
        }
    }
}

// Populate Brands Datalist autocomplete suggestions
function populateBrandSuggestions() {
    const list = document.getElementById('brand-suggestions');
    if (!list) return;
    
    list.innerHTML = '';
    // Find unique brand values
    const uniqueBrands = [...new Set(state.purchases.map(p => p.brand))];
    
    uniqueBrands.forEach(brand => {
        const opt = document.createElement('option');
        opt.value = brand;
        list.appendChild(opt);
    });
}

// Update Dashboard KPI Values & Activities
function updateDashboard() {
    // Totals
    const totalSales = state.sales.reduce((sum, s) => sum + s.items.reduce((sSum, i) => sSum + (i.qty * i.price), 0), 0);
    const totalPurchases = state.purchases.reduce((sum, p) => sum + p.amount, 0);
    const outstandingBalance = state.sales.reduce((sum, s) => sum + s.balance, 0);
    
    // Future dated cheques are classified pending
    const todayStr = new Date().toISOString().split('T')[0];
    const pendingCheques = state.purchases.filter(p => p.chequePaid && p.chequeDate >= todayStr).length;
    const clearedCheques = state.purchases.filter(p => p.chequePaid && p.chequeDate < todayStr).length;
    
    const customersWithBalanceCount = state.sales.filter(s => s.balance > 0).length;

    // Set KPI widgets
    document.getElementById('kpi-total-sales').textContent = formatCurrency(totalSales);
    document.getElementById('kpi-total-purchases').textContent = formatCurrency(totalPurchases);
    document.getElementById('kpi-outstanding-balance').textContent = formatCurrency(outstandingBalance);
    document.getElementById('kpi-pending-cheques').textContent = pendingCheques;
    document.getElementById('kpi-cleared-cheques').textContent = clearedCheques;
    document.getElementById('kpi-customers-balance-count').textContent = `${customersWithBalanceCount} persons`;

    // Render Recent Activities list
    const activitiesList = document.getElementById('dashboard-recent-activities');
    activitiesList.innerHTML = '';

    // Merge transactions and sort by date
    const allActivities = [
        ...state.purchases.map(p => ({ ...p, type: 'purchase' })),
        ...state.sales.map(s => ({ ...s, type: 'sell', amount: s.items.reduce((sum, i) => sum + (i.qty * i.price), 0) }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

    if (allActivities.length === 0) {
        activitiesList.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                <p>No recent activity recorded yet.</p>
            </div>
        `;
    } else {
        allActivities.forEach(act => {
            const item = document.createElement('div');
            item.className = 'recent-item';
            
            const isPurchase = act.type === 'purchase';
            const iconClass = isPurchase ? 'purchase' : 'sell';
            const title = isPurchase ? `Purchased: ${escapeHTML(act.brand)}` : `Invoice: ${escapeHTML(act.invoice)}`;
            const meta = isPurchase ? `Inv Ref: ${escapeHTML(act.invoice)}` : `Items: ${act.items.length} logged`;
            
            const amountPrefix = isPurchase ? '-' : '+';
            const amountColor = isPurchase ? 'var(--text-main)' : 'var(--accent-success)';

            item.innerHTML = `
                <div class="recent-left">
                    <span class="recent-indicator ${iconClass}"></span>
                    <div class="recent-desc">
                        <span class="recent-title">${title}</span>
                        <span class="recent-meta">${meta} • ${formatDate(act.date)}</span>
                    </div>
                </div>
                <span class="recent-amount" style="color: ${amountColor};">${amountPrefix}${formatCurrency(act.amount)}</span>
            `;
            activitiesList.appendChild(item);
        });
    }

    renderChart();
}

// Render Activity Visual Chart (Lightweight Custom Dynamic SVG Bars)
function renderChart() {
    const container = document.getElementById('chart-bars-container');
    if (!container) return;

    const daysCount = parseInt(document.getElementById('chart-timeframe').value) || 30;
    
    // Group transaction aggregates by dates
    const dateGroups = {};
    const today = new Date();
    
    // Populate date buckets
    for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const key = d.toISOString().split('T')[0];
        dateGroups[key] = { sales: 0, purchases: 0 };
    }

    // Accumulate Purchases
    state.purchases.forEach(p => {
        if (dateGroups[p.date]) {
            dateGroups[p.date].purchases += p.amount;
        }
    });

    // Accumulate Sales
    state.sales.forEach(s => {
        if (dateGroups[s.date]) {
            const total = s.items.reduce((sum, item) => sum + (item.qty * item.price), 0);
            dateGroups[s.date].sales += total;
        }
    });

    // Check timeframe scaling (we'll group by intervals if there are many days)
    let intervals = [];
    const keys = Object.keys(dateGroups);

    if (daysCount === 7) {
        // Daily
        keys.forEach(key => {
            const dateObj = new Date(key);
            const label = dateObj.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
            intervals.push({
                label,
                sales: dateGroups[key].sales,
                purchases: dateGroups[key].purchases
            });
        });
    } else if (daysCount === 30) {
        // Group into 6 intervals of 5 days each
        const intervalSize = 5;
        for (let i = 0; i < keys.length; i += intervalSize) {
            const chunk = keys.slice(i, i + intervalSize);
            let sSum = 0, pSum = 0;
            chunk.forEach(k => {
                sSum += dateGroups[k].sales;
                pSum += dateGroups[k].purchases;
            });
            const d1 = new Date(chunk[0]);
            const label = `${d1.getDate()} ${d1.toLocaleDateString('en-US', { month: 'short' })}`;
            intervals.push({ label, sales: sSum, purchases: pSum });
        }
    } else {
        // Group into 9 intervals of 10 days each
        const intervalSize = 10;
        for (let i = 0; i < keys.length; i += intervalSize) {
            const chunk = keys.slice(i, i + intervalSize);
            let sSum = 0, pSum = 0;
            chunk.forEach(k => {
                sSum += dateGroups[k].sales;
                pSum += dateGroups[k].purchases;
            });
            const d1 = new Date(chunk[0]);
            const label = `${d1.getDate()} ${d1.toLocaleDateString('en-US', { month: 'short' })}`;
            intervals.push({ label, sales: sSum, purchases: pSum });
        }
    }

    // Determine max value for percentage scaling
    const maxVal = Math.max(...intervals.map(item => Math.max(item.sales, item.purchases)), 100);

    container.innerHTML = '';
    
    intervals.forEach(interval => {
        const salesPct = (interval.sales / maxVal) * 100;
        const purchasesPct = (interval.purchases / maxVal) * 100;

        const wrapper = document.createElement('div');
        wrapper.className = 'chart-bar-wrapper';
        
        wrapper.innerHTML = `
            <div class="chart-bar-group">
                <div class="chart-bar sales" style="height: ${Math.max(salesPct, 4)}%;" data-value="${formatCurrency(interval.sales)}"></div>
                <div class="chart-bar purchases" style="height: ${Math.max(purchasesPct, 4)}%;" data-value="${formatCurrency(interval.purchases)}"></div>
            </div>
            <span class="chart-label">${interval.label}</span>
        `;
        container.appendChild(wrapper);
    });
}

// Utility Formatter helpers
function formatCurrency(val) {
    return _currencyFmt.format(val);
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHTML(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Data Actions: Export ledger databases to CSV file
function exportCSV(type) {
    let csvContent = "data:text/csv;charset=utf-8,";
    
    if (type === 'purchases') {
        csvContent += "Invoice No,Brand Name,Date,Amount,Cheque Paid,Cheque Number,Cheque Date,Remarks\r\n";
        state.purchases.forEach(p => {
            const row = [
                `"${p.invoice.replace(/"/g, '""')}"`,
                `"${p.brand.replace(/"/g, '""')}"`,
                p.date,
                p.amount,
                p.chequePaid ? "YES" : "NO",
                `"${(p.chequeNo || '').replace(/"/g, '""')}"`,
                p.chequeDate || '',
                `"${(p.remark || '').replace(/"/g, '""')}"`
            ].join(",");
            csvContent += row + "\r\n";
        });
    } else {
        csvContent += "Invoice No,Date,Items List Summary,Total Invoice Amount,Paid Amount,Remaining Balance Due,Customer Remarks\r\n";
        state.sales.forEach(s => {
            const total = s.items.reduce((sum, item) => sum + (item.qty * item.price), 0);
            const itemsSummary = s.items.map(i => `${i.qty}x ${i.name} (₹${i.price})`).join(" | ");
            const row = [
                `"${s.invoice.replace(/"/g, '""')}"`,
                s.date,
                `"${itemsSummary.replace(/"/g, '""')}"`,
                total,
                s.paidAmount,
                s.balance,
                `"${(s.remark || '').replace(/"/g, '""')}"`
            ].join(",");
            csvContent += row + "\r\n";
        });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `aura_pos_${type}_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// JSON Backup Utilities
function exportJSON() {
    const backupStr = JSON.stringify(state, null, 2);
    const blob = new Blob([backupStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `aura_pos_full_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function importJSONFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (imported.purchases && imported.sales && Array.isArray(imported.purchases) && Array.isArray(imported.sales)) {
                if (confirm('Importing this file will completely overwrite your current transaction database. Are you sure you want to proceed?')) {
                    state.purchases = imported.purchases;
                    state.sales = imported.sales;
                    saveData();
                    updateDashboard();
                    renderPurchasesTable();
                    renderSalesTable();
                    alert('Database successfully restored from JSON backup!');
                }
            } else {
                alert('Invalid backup file layout. Ensure the JSON contains valid purchases and sales registers.');
            }
        } catch (err) {
            alert('Error parsing JSON backup file. Ensure the file integrity is intact.');
        }
    };
    reader.readAsText(file);
}

// Seed Demo Transactions for system visualization
function seedDemoDatabase() {
    if (confirm('Seeding dummy transactions will replace or append mock ledger records. Proceed?')) {
        const mockPurchases = [
            { id: 'pur_1', invoice: 'PUR-2026-001', brand: 'Nike Inc', date: '2026-05-10', amount: 15000.00, chequePaid: true, chequeNo: 'CHQ402910', chequeDate: '2026-05-12', remark: 'Bulk supply order for summer running collection' },
            { id: 'pur_2', invoice: 'PUR-2026-002', brand: 'Adidas', date: '2026-05-18', amount: 8200.50, chequePaid: false, chequeNo: '', chequeDate: '', remark: 'Replenishment order for sportswear' },
            { id: 'pur_3', invoice: 'PUR-2026-003', brand: 'Apple Corp', date: '2026-06-01', amount: 32000.00, chequePaid: true, chequeNo: 'CHQ882012', chequeDate: '2026-06-15', remark: 'MacBook inventory purchase for premium customer orders' },
            { id: 'pur_4', invoice: 'PUR-2026-004', brand: 'Sony Global', date: '2026-06-03', amount: 12500.00, chequePaid: true, chequeNo: 'CHQ700921', chequeDate: '2026-06-04', remark: 'Playstation 5 console shipment payment cleared' }
        ];

        const mockSales = [
            {
                id: 'sale_1',
                invoice: 'INV-2026-101',
                date: '2026-05-15',
                items: [
                    { name: 'Air Zoom Running Shoes', qty: 20, price: 120.00 },
                    { name: 'Sport Crew Socks pack', qty: 15, price: 15.00 }
                ],
                paymentType: 'paid-now',
                paidAmount: 2625.00,
                balance: 0,
                remark: 'David Miller (Manager, Gym Club). Delivered to site.'
            },
            {
                id: 'sale_2',
                invoice: 'INV-2026-102',
                date: '2026-05-25',
                items: [
                    { name: 'UltraBoost Athletic Trainer', qty: 10, price: 180.00 },
                    { name: 'Windbreaker Jacket', qty: 5, price: 90.00 }
                ],
                paymentType: 'partial',
                paidAmount: 1000.00,
                balance: 1250.00,
                remark: 'Alice Vance (Vance Outfitters). Paid $1000 deposit. Promised rest next Friday.'
            },
            {
                id: 'sale_3',
                invoice: 'INV-2026-103',
                date: '2026-06-02',
                items: [
                    { name: 'MacBook Pro 16 M3 Max', qty: 2, price: 3499.00 }
                ],
                paymentType: 'paid-later',
                paidAmount: 0,
                balance: 6998.00,
                remark: 'Tech Startup Corp (Attn: CEO Sarah). Net 30 payment agreement invoice.'
            }
        ];

        state.purchases = mockPurchases;
        state.sales = mockSales;
        saveData();
        
        updateDashboard();
        renderPurchasesTable();
        renderSalesTable();
        alert('Dummy ledger database successfully seeded!');
    }
}

// Clear Database completely
function clearDatabase() {
    if (confirm('WARNING! This will permanently erase ALL purchase and sales records from this browser cache. Are you sure you want to reset everything?')) {
        state.purchases = [];
        state.sales = [];
        saveData();
        updateDashboard();
        renderPurchasesTable();
        renderSalesTable();
        alert('Ledger database successfully reset.');
    }
}

// Seed initial admin data if empty
function seedAdminInitialData() {
    if (state.workers.length === 0) {
        state.workers = [
            { id: 'wk_1', email: 'manager@aurapos.com', role: 'Manager', joined: '2026-05-15' },
            { id: 'wk_2', email: 'worker.george@aurapos.com', role: 'Worker', joined: '2026-06-01' }
        ];
        logAuditEvent('System initialized: Seeded default worker accounts.', 'system');
    }
    if (state.pendingRequests.length === 0 && localStorage.getItem('aura_pos_pending') === null) {
        state.pendingRequests = [
            { email: 'alex.signup@gmail.com', date: '2026-06-04' },
            { email: 'jane.pos@outlook.com', date: '2026-06-05' }
        ];
    }
    if (state.categories.length === 0) {
        state.categories = ['Apparel', 'Footwear', 'Electronics', 'Services'];
    }
    if (state.masterItems.length === 0) {
        state.masterItems = [
            { name: 'Air Zoom Running Shoes', price: 9800.00 },
            { name: 'UltraBoost Athletic Trainer', price: 14700.00 },
            { name: 'MacBook Pro 16 M3 Max', price: 289000.00 },
            { name: 'Sony Playstation 5', price: 54999.00 }
        ];
    }
    
    // Save seeded defaults to LocalStorage directly on initialization
    localStorage.setItem('aura_pos_workers', JSON.stringify(state.workers));
    localStorage.setItem('aura_pos_pending', JSON.stringify(state.pendingRequests));
    localStorage.setItem('aura_pos_categories', JSON.stringify(state.categories));
    localStorage.setItem('aura_pos_master_items', JSON.stringify(state.masterItems));
}

// Log audit events
function logAuditEvent(message, type = 'info') {
    const logEntry = {
        id: 'log_' + Date.now() + Math.random().toString(36).substr(2, 4),
        message,
        type,
        timestamp: new Date().toISOString()
    };
    state.auditLogs.unshift(logEntry);
    if (state.auditLogs.length > 50) {
        state.auditLogs.pop(); // Cap at 50 logs
    }
}

// Refresh all components of the Admin Panel
function refreshAdminPanel() {
    renderWorkersTable();
    renderPendingRequests();
    renderCategoriesTable();
    renderLogs();
    renderItemsSummary();
}

// Render Workers List
function renderWorkersTable() {
    const tbody = document.getElementById('workers-tbody');
    const emptyState = document.getElementById('workers-empty-state');
    const countSpan = document.getElementById('workers-count');
    
    if (!tbody) return;
    tbody.innerHTML = '';
    
    countSpan.textContent = state.workers.length;
    
    if (state.workers.length === 0) {
        emptyState.style.display = 'flex';
        return;
    }
    emptyState.style.display = 'none';
    
    state.workers.forEach(w => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 600;">${escapeHTML(w.email)}</td>
            <td><span class="badge ${w.role === 'Manager' ? 'badge-info' : 'badge-paid'}">${escapeHTML(w.role)}</span></td>
            <td>${formatDate(w.joined)}</td>
            <td style="text-align: right;">
                <button class="action-btn delete" onclick="deleteWorker('${w.id}')" title="Delete Worker Account">
                    <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Delete Worker helper
function deleteWorker(id) {
    const worker = state.workers.find(w => w.id === id);
    if (!worker) return;
    
    if (confirm(`Are you sure you want to delete worker account: ${worker.email}?`)) {
        state.workers = state.workers.filter(w => w.id !== id);
        logAuditEvent(`Deleted worker account: ${worker.email}`, 'delete');
        saveData();
    }
}

// Render Pending Requests Card
function renderPendingRequests() {
    const container = document.getElementById('pending-requests-container');
    const countSpan = document.getElementById('pending-requests-count');
    
    if (!container) return;
    container.innerHTML = '';
    
    countSpan.textContent = state.pendingRequests.length;
    
    if (state.pendingRequests.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 1.5rem;">
                <svg viewBox="0 0 24 24" style="color: var(--accent-success);"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <p>No pending signup requests right now.</p>
            </div>
        `;
        return;
    }
    
    state.pendingRequests.forEach(req => {
        const div = document.createElement('div');
        div.className = 'pending-request-item';
        div.innerHTML = `
            <div class="pending-request-info">
                <span class="pending-request-email">${escapeHTML(req.email)}</span>
                <span class="pending-request-date">Requested: ${formatDate(req.date)}</span>
            </div>
            <div class="pending-request-actions">
                <button class="btn btn-success btn-sm" onclick="approvePendingRequest('${escapeHTML(req.email)}')" style="padding: 0.35rem 0.65rem;">Approve</button>
                <button class="btn btn-secondary btn-sm" onclick="deletePendingRequest('${escapeHTML(req.email)}')" style="padding: 0.35rem 0.65rem;">Dismiss</button>
            </div>
        `;
        container.appendChild(div);
    });
}

// Approve pending request helper
function approvePendingRequest(email) {
    const request = state.pendingRequests.find(r => r.email === email);
    if (!request) return;
    
    // Add to workers list
    const newWorker = {
        id: 'wk_' + Date.now(),
        email: request.email,
        role: 'Worker',
        password: 'workerTempPass123',
        joined: new Date().toISOString().split('T')[0]
    };
    
    state.workers.push(newWorker);
    state.pendingRequests = state.pendingRequests.filter(r => r.email !== email);
    logAuditEvent(`Approved and created account for worker: ${email}`, 'create');
    saveData();
}

// Reject/Dismiss pending request
function deletePendingRequest(email) {
    if (confirm(`Dismiss pending access request from: ${email}?`)) {
        state.pendingRequests = state.pendingRequests.filter(r => r.email !== email);
        logAuditEvent(`Dismissed access request from: ${email}`, 'delete');
        saveData();
    }
}

// Render Categories List
function renderCategoriesTable() {
    const tbody = document.getElementById('admin-categories-tbody');
    const countSpan = document.getElementById('categories-count');
    
    if (!tbody) return;
    tbody.innerHTML = '';
    
    countSpan.textContent = state.categories.length;
    
    if (state.categories.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" class="text-muted" style="text-align: center;">No categories configured.</td></tr>`;
        return;
    }
    
    state.categories.forEach((cat, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 600;">${escapeHTML(cat)}</td>
            <td style="text-align: right;">
                <button class="action-btn delete" onclick="deleteCategory(${index})" title="Delete Category">
                    <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Delete Category
function deleteCategory(index) {
    const catName = state.categories[index];
    if (confirm(`Are you sure you want to delete category: ${catName}?`)) {
        state.categories.splice(index, 1);
        logAuditEvent(`Deleted category: ${catName}`, 'delete');
        saveData();
    }
}

// Render Audit Logs list
function renderLogs() {
    const container = document.getElementById('admin-logs-container');
    if (!container) return;
    container.innerHTML = '';
    
    if (state.auditLogs.length === 0) {
        container.innerHTML = `<div class="empty-state" style="padding: 2rem;"><p>Audit trail is empty.</p></div>`;
        return;
    }
    
    state.auditLogs.forEach(log => {
        const div = document.createElement('div');
        div.className = 'audit-log-item';
        
        let timeStr = '-';
        try {
            timeStr = new Date(log.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }) + ' ' + formatDate(log.timestamp);
        } catch(e) {}
        
        div.innerHTML = `
            <span class="audit-log-indicator ${escapeHTML(log.type)}"></span>
            <div class="audit-log-details">
                <span class="audit-log-message">${escapeHTML(log.message)}</span>
                <span class="audit-log-timestamp">${timeStr}</span>
            </div>
        `;
        container.appendChild(div);
    });
}

// Render Master items summary list
function renderItemsSummary() {
    const tbody = document.getElementById('admin-items-summary-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (state.masterItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" class="text-muted" style="text-align: center;">Master items list is empty.</td></tr>`;
        return;
    }
    
    state.masterItems.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${escapeHTML(item.name)}</td>
            <td style="text-align: right; font-weight: 700;">${formatCurrency(item.price)}</td>
        `;
        tbody.appendChild(tr);
    });
}

