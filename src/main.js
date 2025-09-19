import { setupNotificationsForClient, sendRequestToDashboard, generateWhatsAppLink } from './notification-module.js';

document.addEventListener('DOMContentLoaded', () => {
    // ========== 1. CONFIG & STATE ==========
    const WA_NUMBER = "972508860896";
    let clientState = { id: null, name: null, avatar: null };
    let materialOrder = { items: [], deliveryDetails: {} };
    let currentPageId = 'page-home';
    const dom = {};

    // ========== 2. CORE APP LOGIC ==========
    function initApp() {
        if (!cacheDomElements()) {
            document.body.innerHTML = `<div style="padding: 20px; text-align: center; font-family: Assistant, sans-serif;"><h1>שגיאת טעינה</h1><p>רכיבים חיוניים חסרים. לא ניתן להפעיל את האפליקציה.</p><p>בדוק את הקונסול (F12) לפרטים.</p></div>`;
            document.body.classList.add('loaded');
            return;
        }
        
        document.body.classList.add('loaded');
        setupEventListeners();
        
        // Placeholder for client login logic
        // In a real app, this would be determined after user authentication
        clientState = { id: 'mock_client_123', name: 'ישראל ישראלי' };
        
        if (clientState.id) {
            setupNotificationsForClient(clientState.id);
            renderAllPages();
            navigateTo('page-home', true);
        } else {
            // Handle login prompt if necessary
        }
    }

    // ========== 3. DOM & EVENT LISTENERS ==========
    function cacheDomElements() {
        const elements = {
            appHeader: document.querySelector('.app-header'),
            pages: document.querySelectorAll('.page'),
            navButtons: document.querySelectorAll('.nav-btn'),
            greeting: document.getElementById('greeting'),
            homeContent: document.getElementById('home-content'),
            
            // Materials Wizard
            materialsProgress: document.getElementById('materials-progress'),
            materialInput: document.getElementById('material-input'),
            materialsListContainer: document.getElementById('materials-list-container'),
            materialsStep1Next: document.getElementById('materials-step1-next'),
            
            materialsDeliveryForm: document.getElementById('materials-delivery-form'),
            matContactPerson: document.getElementById('mat-contact-person'),
            matContactPhone: document.getElementById('mat-contact-phone'),
            matDeliveryAddress: document.getElementById('mat-delivery-address'),
            matAddLocationBtn: document.getElementById('mat-add-location-btn'),
            materialsStep2Back: document.getElementById('materials-step2-back'),
            materialsStep2Next: document.getElementById('materials-step2-next'),

            materialsSummary: document.getElementById('materials-summary'),
            materialsStep3Back: document.getElementById('materials-step3-back'),
            submitMaterialOrderBtn: document.getElementById('submit-material-order-btn'),

            historyContent: document.getElementById('history-content'),
            modalContainer: document.getElementById('modal-container'),
            toastContainer: document.getElementById('toast-container')
        };

        for (const key in elements) {
            if (!elements[key]) {
                console.error(`DOM Caching Error: Element "${key}" not found.`);
                return false;
            }
        }
        Object.assign(dom, elements);
        return true;
    }

    function setupEventListeners() {
        dom.navButtons.forEach(btn => btn.addEventListener('click', () => navigateTo(btn.dataset.page)));

        // Materials Wizard Navigation
        dom.materialsStep1Next.addEventListener('click', () => navigateWizard('materials', 2));
        dom.materialsStep2Back.addEventListener('click', () => navigateWizard('materials', 1));
        dom.materialsStep2Next.addEventListener('click', () => {
            renderMaterialSummary();
            navigateWizard('materials', 3);
        });
        dom.materialsStep3Back.addEventListener('click', () => navigateWizard('materials', 2));

        // Materials Functionality
        dom.materialInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') handleMaterialAdd();
        });
        dom.materialsListContainer.addEventListener('click', handleMaterialsListClick);
        dom.materialsDeliveryForm.addEventListener('input', validateMaterialStep2);
        dom.submitMaterialOrderBtn.addEventListener('click', handleMaterialOrderSubmit);
        dom.matAddLocationBtn.addEventListener('click', getGeoLocation);
    }
    
    // ========== 4. UI RENDERING & STATE MANAGEMENT ==========
    function renderAllPages() {
        renderHeader();
        renderHomePage();
        renderHistoryPage();
    }
    
    function renderHeader() {
        dom.appHeader.innerHTML = `
            <div id="profile-container">
                <img src="https://i.postimg.cc/2SbDgD1B/1.png" alt="Logo" style="width: 40px; height: 40px; border-radius: 50%;">
            </div>
            <h1 style="font-weight: 800; font-size: 20px;">ח. סבן</h1>
            <div style="width: 40px;"></div> <!-- Spacer -->
        `;
    }

    function renderHomePage() {
        dom.greeting.textContent = `בוקר טוב, ${clientState.name.split(' ')[0]}`;
        // Add content for the home page here
        dom.homeContent.innerHTML = `<div class="card"><p>ברוך הבא לאזור האישי. כאן תוכל לנהל את כל ההזמנות שלך בקלות ובמהירות.</p></div>`;
    }
    
    function renderHistoryPage() {
        // Placeholder for history content
        dom.historyContent.innerHTML = `<div class="card"><p>היסטוריית ההזמנות שלך תופיע כאן.</p></div>`;
    }

    function navigateTo(pageId, isInitial = false) {
        if (!isInitial && pageId === currentPageId) return;
        
        dom.pages.forEach(p => p.classList.remove('active'));
        document.getElementById(pageId)?.classList.add('active');
        
        currentPageId = pageId;
        dom.navButtons.forEach(b => b.classList.toggle('active', b.dataset.page === pageId));
    }

    // ========== 5. MATERIALS WIZARD LOGIC ==========
    function navigateWizard(wizard, step) {
        document.querySelectorAll(`.${wizard}-step`).forEach(s => s.classList.remove('active'));
        document.getElementById(`${wizard}-step-${step}`).classList.add('active');
        dom[`${wizard}Progress`].style.width = `${step * 33.3}%`;
        
        // Haptic feedback for mobile
        if (navigator.vibrate) navigator.vibrate(50);
    }

    function handleMaterialAdd() {
        const productName = dom.materialInput.value.trim();
        if (productName) {
            materialOrder.items.push({ product: productName, quantity: 1 });
            renderMaterialsList();
            dom.materialInput.value = '';
            dom.materialInput.focus();
        }
    }

    function renderMaterialsList() {
        if (materialOrder.items.length === 0) {
            dom.materialsListContainer.innerHTML = `<p style="text-align: center; color: var(--text-muted);">רשימת המוצרים שלך תופיע כאן.</p>`;
        } else {
            dom.materialsListContainer.innerHTML = materialOrder.items.map((item, index) => `
                <div class="material-item">
                    <span class="material-name">${index + 1}. ${item.product}</span>
                    <div class="quantity-control">
                        <button class="quantity-btn" data-index="${index}" data-op="-">-</button>
                        <input type="number" class="material-quantity" value="${item.quantity}" min="1" data-index="${index}">
                        <button class="quantity-btn" data-index="${index}" data-op="+">+</button>
                    </div>
                    <button class="material-delete-btn" data-index="${index}">✖</button>
                </div>
            `).join('');
        }
        dom.materialsStep1Next.disabled = materialOrder.items.length === 0;
    }
    
    function handleMaterialsListClick(e) {
        const target = e.target;
        const index = parseInt(target.dataset.index);

        if (target.classList.contains('material-delete-btn')) {
            materialOrder.items.splice(index, 1);
        } else if (target.classList.contains('quantity-btn')) {
            const op = target.dataset.op;
            if (op === '+') materialOrder.items[index].quantity++;
            if (op === '-') materialOrder.items[index].quantity = Math.max(1, materialOrder.items[index].quantity - 1);
        } else if (target.classList.contains('material-quantity')) {
             target.addEventListener('change', () => {
                materialOrder.items[index].quantity = parseInt(target.value) || 1;
             });
             return; // Avoid re-rendering on every input event
        }
        renderMaterialsList();
    }

    function validateMaterialStep2() {
        const isFormValid = dom.matContactPerson.value.trim() && 
                            dom.matContactPhone.value.trim() && 
                            dom.matDeliveryAddress.value.trim();
        dom.materialsStep2Next.disabled = !isFormValid;
    }
    
    function renderMaterialSummary() {
        const deliveryDetails = {
            contactPerson: dom.matContactPerson.value,
            contactPhone: dom.matContactPhone.value,
            deliveryAddress: dom.matDeliveryAddress.value
        };
        materialOrder.deliveryDetails = deliveryDetails;
        
        const itemsList = materialOrder.items.map((item, i) => `${i + 1}. ${item.product} (כמות: ${item.quantity})`).join('\n');
        
        dom.materialsSummary.innerHTML = `
            <p><strong>איש קשר:</strong> ${deliveryDetails.contactPerson} (${deliveryDetails.contactPhone})</p>
            <p><strong>כתובת:</strong> ${deliveryDetails.deliveryAddress}</p>
            <h4 style="margin-top: 15px;">פריטים: (${materialOrder.items.length})</h4>
            <pre>${itemsList}</pre>
        `;
    }

    async function handleMaterialOrderSubmit() {
        const orderData = {
            type: 'חומרי בנין',
            clientName: clientState.name,
            contactPerson: materialOrder.deliveryDetails.contactPerson,
            contactPhone: materialOrder.deliveryDetails.contactPhone,
            deliveryAddress: materialOrder.deliveryDetails.deliveryAddress,
            items: materialOrder.items
        };

        showToast('שולח הזמנה...', 'info');
        const success = await sendRequestToDashboard(clientState, 'הזמנת חומרי בנין', orderData);

        if (success) {
            const whatsappLink = generateWhatsAppLink(orderData);
            window.open(whatsappLink, '_blank');
            showToast('הזמנה נשלחה בהצלחה!', 'success');
            resetMaterialOrder();
            navigateTo('page-home');
        } else {
            showToast('שגיאה בשליחת ההזמנה', 'error');
        }
    }

    function resetMaterialOrder() {
        materialOrder = { items: [], deliveryDetails: {} };
        renderMaterialsList();
        dom.materialsDeliveryForm.reset();
        validateMaterialStep2();
        navigateWizard('materials', 1);
    }
    
    // ========== 6. UTILITIES ==========
    function getGeoLocation() {
        if (!navigator.geolocation) return showToast("שירותי מיקום לא נתמכים.", 'warning');
        
        showToast("מאחזר מיקום...", 'info');
        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                const data = await response.json();
                const addressField = currentPageId === 'page-materials' ? dom.matDeliveryAddress : null; // Add for other forms if needed
                if (addressField) {
                    addressField.value = data.display_name || `קואורדינטות: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
                    validateMaterialStep2();
                }
                showToast("המיקום עודכן!", 'success');
            } catch (error) {
                showToast("שגיאה באחזור כתובת", 'error');
            }
        }, () => showToast("לא ניתן היה לקבל את מיקומך.", 'error'));
    }

    function showToast(message, type = 'info') {
        const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> <span>${message}</span>`;
        dom.toastContainer.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove());
        }, 3000);
    }
    
    // ========== 7. APP INITIALIZATION ==========
    initApp();
});

