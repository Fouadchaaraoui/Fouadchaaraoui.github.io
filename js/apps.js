(function () {
    const state = {
        rooms: [],
        customers: [],
        bookings: [],
        settings: {
            hotelName: "Grand Horizon",
            contactEmail: "info@grandhorizon.com",
            currency: "USD",
            autoConfirmBookings: true,
            vipArrivalAlerts: true,
            maintenanceReminders: false
        }
    };

    function apiBase() {
        return "api";
    }

    async function apiRequest(path, options) {
        const response = await fetch(apiBase() + path, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            ...options
        });

        let data = {};
        try {
            data = await response.json();
        } catch (error) {
            data = {};
        }

        if (!response.ok) {
            const message = data.message || "Request failed.";
            if (response.status === 401) {
                window.location.href = "auth/login.html";
                throw new Error("Unauthorized");
            }
            throw new Error(message);
        }
        return data;
    }

    function normalize(value) {
        return String(value || "").trim().toLowerCase();
    }

    function escapeHtml(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll("\"", "&quot;")
            .replaceAll("'", "&#039;");
    }

    function showToast(message) {
        const toast = document.createElement("div");
        toast.className = "toast";
        toast.textContent = message;
        document.body.appendChild(toast);

        requestAnimationFrame(function () {
            toast.classList.add("show");
        });

        setTimeout(function () {
            toast.classList.remove("show");
            setTimeout(function () {
                toast.remove();
            }, 250);
        }, 1800);
    }

    function getBadgeClass(status) {
        const value = normalize(status);
        if (value === "available" || value === "vip") return "success";
        if (value === "maintenance") return "warning";
        if (value === "occupied") return "danger";
        return "";
    }

    function buildMaps() {
        const roomMap = new Map(state.rooms.map(function (room) { return [String(room.id), room]; }));
        const customerMap = new Map(state.customers.map(function (customer) { return [String(customer.id), customer]; }));
        return { roomMap: roomMap, customerMap: customerMap };
    }

    function stayNights(booking) {
        const start = new Date(booking.checkIn + "T00:00:00").getTime();
        const end = new Date(booking.checkOut + "T00:00:00").getTime();
        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
            return 1;
        }
        const dayMs = 1000 * 60 * 60 * 24;
        return Math.max(1, Math.round((end - start) / dayMs));
    }

    function bookingRevenue(booking, roomMap) {
        const room = roomMap.get(String(booking.roomId));
        if (!room) return 0;
        return stayNights(booking) * (Number(room.price) || 0);
    }

    function applyGlobalSettings() {
        const logos = document.querySelectorAll(".logo span");
        logos.forEach(function (node) {
            node.textContent = state.settings.hotelName;
        });
    }

    function renderDateTime() {
        const dateTimeEl = document.getElementById("liveDateTime");
        if (!dateTimeEl) return;
        const now = new Date();
        const date = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        const time = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
        dateTimeEl.textContent = date + " | " + time;
    }

    async function fetchRooms() {
        const data = await apiRequest("/rooms.php");
        state.rooms = Array.isArray(data.items) ? data.items : [];
    }

    async function fetchCustomers() {
        const data = await apiRequest("/customers.php");
        state.customers = Array.isArray(data.items) ? data.items : [];
    }

    async function fetchBookings() {
        const data = await apiRequest("/bookings.php");
        state.bookings = Array.isArray(data.items) ? data.items : [];
    }

    async function fetchSettings() {
        const data = await apiRequest("/settings.php");
        state.settings = data.item || state.settings;
        applyGlobalSettings();
    }

    async function loadAllData() {
        await Promise.all([fetchRooms(), fetchCustomers(), fetchBookings(), fetchSettings()]);
    }

    function renderInsights() {
        const occupancyEl = document.getElementById("insightOccupancy");
        const occupancyBar = document.getElementById("insightOccupancyBar");
        const vipEl = document.getElementById("insightVip");
        const vipBar = document.getElementById("insightVipBar");
        const stayEl = document.getElementById("insightStay");
        const stayBar = document.getElementById("insightStayBar");
        if (!occupancyEl || !occupancyBar || !vipEl || !vipBar || !stayEl || !stayBar) return;

        const occupiedRooms = state.rooms.filter(function (room) {
            return normalize(room.status) === "occupied";
        }).length;
        const occupancyPct = state.rooms.length ? Math.round((occupiedRooms / state.rooms.length) * 100) : 0;

        const vipCustomers = state.customers.filter(function (customer) {
            return normalize(customer.status) === "vip";
        }).length;
        const vipPct = state.customers.length ? Math.round((vipCustomers / state.customers.length) * 100) : 0;

        let avgStay = 0;
        if (state.bookings.length) {
            const totalStay = state.bookings.reduce(function (sum, booking) {
                return sum + stayNights(booking);
            }, 0);
            avgStay = Math.round((totalStay / state.bookings.length) * 10) / 10;
        }
        const stayPct = Math.min(100, Math.round((avgStay / 7) * 100));

        occupancyEl.textContent = occupancyPct + "%";
        occupancyBar.style.width = occupancyPct + "%";
        vipEl.textContent = vipPct + "%";
        vipBar.style.width = vipPct + "%";
        stayEl.textContent = avgStay + " nights";
        stayBar.style.width = stayPct + "%";
    }

    function renderRecentBookings() {
        const recentBody = document.getElementById("recentBookingsBody");
        if (!recentBody) return;
        const maps = buildMaps();
        const bookings = state.bookings.slice().sort(function (a, b) {
            return new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime();
        }).slice(0, 5);

        if (!bookings.length) {
            recentBody.innerHTML = "<tr><td colspan=\"4\">No bookings yet.</td></tr>";
            return;
        }

        recentBody.innerHTML = bookings.map(function (booking) {
            const customer = maps.customerMap.get(String(booking.customerId));
            const room = maps.roomMap.get(String(booking.roomId));
            return "<tr>" +
                "<td>" + escapeHtml(booking.id) + "</td>" +
                "<td>" + escapeHtml(customer ? customer.name : "Unknown") + "</td>" +
                "<td>" + escapeHtml(room ? room.number : "N/A") + "</td>" +
                "<td>" + escapeHtml(booking.checkIn) + "</td>" +
                "</tr>";
        }).join("");
    }

    function renderDashboard() {
        const roomsEl = document.getElementById("metricRooms");
        const bookingsEl = document.getElementById("metricBookings");
        const customersEl = document.getElementById("metricCustomers");
        const revenueEl = document.getElementById("metricRevenue");
        if (!roomsEl || !bookingsEl || !customersEl || !revenueEl) return;

        const maps = buildMaps();
        let totalRevenue = 0;
        state.bookings.forEach(function (booking) {
            totalRevenue += bookingRevenue(booking, maps.roomMap);
        });

        roomsEl.textContent = String(state.rooms.length);
        bookingsEl.textContent = String(state.bookings.length);
        customersEl.textContent = String(state.customers.length);
        revenueEl.textContent = "$" + totalRevenue.toLocaleString("en-US");
        renderInsights();
        renderRecentBookings();
    }

    function renderRooms() {
        const tableBody = document.getElementById("roomsTableBody");
        if (!tableBody) return;

        const search = normalize((document.getElementById("roomsSearch") || {}).value);
        const statusFilter = normalize((document.getElementById("roomsStatusFilter") || {}).value);
        const items = state.rooms.filter(function (room) {
            const text = normalize(room.number + " " + room.type);
            const matchSearch = !search || text.includes(search);
            const matchStatus = !statusFilter || normalize(room.status) === statusFilter;
            return matchSearch && matchStatus;
        });

        if (!items.length) {
            tableBody.innerHTML = "<tr><td colspan=\"5\">No rooms found.</td></tr>";
            return;
        }

        tableBody.innerHTML = items.map(function (room) {
            const badgeClass = getBadgeClass(room.status);
            return "<tr>" +
                "<td>" + escapeHtml(room.number) + "</td>" +
                "<td>" + escapeHtml(room.type) + "</td>" +
                "<td><span class=\"badge " + badgeClass + "\">" + escapeHtml(room.status) + "</span></td>" +
                "<td>$" + Number(room.price).toLocaleString("en-US") + "</td>" +
                "<td class=\"action-group\">" +
                "<button class=\"secondary-btn\" data-action=\"edit-room\" data-id=\"" + room.id + "\">Edit</button>" +
                "<button class=\"danger-btn\" data-action=\"delete-room\" data-id=\"" + room.id + "\">Delete</button>" +
                "</td>" +
                "</tr>";
        }).join("");
    }

    function renderCustomers() {
        const tableBody = document.getElementById("customersTableBody");
        if (!tableBody) return;

        const search = normalize((document.getElementById("customersSearch") || {}).value);
        const statusFilter = normalize((document.getElementById("customersStatusFilter") || {}).value);
        const items = state.customers.filter(function (customer) {
            const text = normalize(customer.name + " " + customer.email + " " + customer.phone);
            const matchSearch = !search || text.includes(search);
            const matchStatus = !statusFilter || normalize(customer.status) === statusFilter;
            return matchSearch && matchStatus;
        });

        if (!items.length) {
            tableBody.innerHTML = "<tr><td colspan=\"5\">No customers found.</td></tr>";
            return;
        }

        tableBody.innerHTML = items.map(function (customer) {
            const badgeClass = getBadgeClass(customer.status);
            return "<tr>" +
                "<td>" + escapeHtml(customer.name) + "</td>" +
                "<td>" + escapeHtml(customer.email) + "</td>" +
                "<td>" + escapeHtml(customer.phone) + "</td>" +
                "<td><span class=\"badge " + badgeClass + "\">" + escapeHtml(customer.status) + "</span></td>" +
                "<td class=\"action-group\">" +
                "<button class=\"secondary-btn\" data-action=\"edit-customer\" data-id=\"" + customer.id + "\">Edit</button>" +
                "<button class=\"danger-btn\" data-action=\"delete-customer\" data-id=\"" + customer.id + "\">Delete</button>" +
                "</td>" +
                "</tr>";
        }).join("");
    }

    function updateBookingInputs() {
        const customerSelect = document.getElementById("bookingCustomer");
        const roomSelect = document.getElementById("bookingRoom");
        if (!customerSelect || !roomSelect) return;

        const selectedCustomer = customerSelect.value;
        const selectedRoom = roomSelect.value;

        customerSelect.innerHTML = "<option value=\"\">Customer</option>" + state.customers.map(function (customer) {
            return "<option value=\"" + customer.id + "\">" + escapeHtml(customer.name) + " (" + escapeHtml(customer.email) + ")</option>";
        }).join("");

        roomSelect.innerHTML = "<option value=\"\">Room</option>" + state.rooms.map(function (room) {
            return "<option value=\"" + room.id + "\">" + escapeHtml(room.number) + " - " + escapeHtml(room.type) + "</option>";
        }).join("");

        customerSelect.value = state.customers.some(function (c) { return String(c.id) === String(selectedCustomer); }) ? selectedCustomer : "";
        roomSelect.value = state.rooms.some(function (r) { return String(r.id) === String(selectedRoom); }) ? selectedRoom : "";
    }

    function renderBookings() {
        const tableBody = document.getElementById("bookingsTableBody");
        if (!tableBody) return;

        const search = normalize((document.getElementById("bookingsSearch") || {}).value);
        const maps = buildMaps();
        const items = state.bookings.filter(function (booking) {
            const customer = maps.customerMap.get(String(booking.customerId));
            const room = maps.roomMap.get(String(booking.roomId));
            const text = normalize(booking.id + " " + (customer ? customer.name : "") + " " + (room ? room.number : ""));
            return !search || text.includes(search);
        });

        if (!items.length) {
            tableBody.innerHTML = "<tr><td colspan=\"6\">No bookings found.</td></tr>";
            return;
        }

        tableBody.innerHTML = items.map(function (booking) {
            const customer = maps.customerMap.get(String(booking.customerId));
            const room = maps.roomMap.get(String(booking.roomId));
            return "<tr>" +
                "<td>" + escapeHtml(booking.id) + "</td>" +
                "<td>" + escapeHtml(customer ? customer.name : "Unknown") + "</td>" +
                "<td>" + escapeHtml(room ? room.number : "N/A") + "</td>" +
                "<td>" + escapeHtml(booking.checkIn) + "</td>" +
                "<td>" + escapeHtml(booking.checkOut) + "</td>" +
                "<td class=\"action-group\">" +
                "<button class=\"secondary-btn\" data-action=\"edit-booking\" data-db-id=\"" + booking.dbId + "\">Edit</button>" +
                "<button class=\"danger-btn\" data-action=\"delete-booking\" data-db-id=\"" + booking.dbId + "\">Delete</button>" +
                "</td>" +
                "</tr>";
        }).join("");
    }

    async function refreshAllData() {
        await Promise.all([fetchRooms(), fetchCustomers(), fetchBookings()]);
        renderRooms();
        renderCustomers();
        updateBookingInputs();
        renderBookings();
        renderDashboard();
    }

    function bindRooms() {
        const form = document.getElementById("roomForm");
        const tableBody = document.getElementById("roomsTableBody");
        const editIdInput = document.getElementById("roomEditId");
        const submitBtn = document.getElementById("roomSubmitBtn");
        const cancelBtn = document.getElementById("roomCancelBtn");
        const numberInput = document.getElementById("roomNumber");
        const typeInput = document.getElementById("roomType");
        const statusInput = document.getElementById("roomStatus");
        const priceInput = document.getElementById("roomPrice");
        if (!form || !tableBody || !editIdInput || !submitBtn || !cancelBtn || !numberInput || !typeInput || !statusInput || !priceInput) return;

        function resetForm() {
            form.reset();
            editIdInput.value = "";
            submitBtn.textContent = "Add Room";
            cancelBtn.style.display = "none";
        }

        resetForm();
        const roomsSearch = document.getElementById("roomsSearch");
        const roomsStatusFilter = document.getElementById("roomsStatusFilter");
        if (roomsSearch) roomsSearch.addEventListener("input", renderRooms);
        if (roomsStatusFilter) roomsStatusFilter.addEventListener("change", renderRooms);

        form.addEventListener("submit", async function (event) {
            event.preventDefault();
            const payload = {
                id: Number(editIdInput.value || 0),
                number: numberInput.value.trim(),
                type: typeInput.value,
                status: statusInput.value,
                price: Number(priceInput.value)
            };

            try {
                if (!payload.number || !payload.type || !payload.status || !Number.isFinite(payload.price) || payload.price <= 0) {
                    throw new Error("Please fill all room fields correctly.");
                }
                if (payload.id > 0) {
                    await apiRequest("/rooms.php", { method: "PUT", body: JSON.stringify(payload) });
                } else {
                    await apiRequest("/rooms.php", { method: "POST", body: JSON.stringify(payload) });
                }
                await refreshAllData();
                resetForm();
                showToast(payload.id > 0 ? "Room updated." : "Room added.");
            } catch (error) {
                alert(error.message || "Failed to save room.");
            }
        });

        cancelBtn.addEventListener("click", resetForm);

        tableBody.addEventListener("click", async function (event) {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            const action = target.dataset.action;
            const id = Number(target.dataset.id || 0);
            if (!action || id <= 0) return;

            if (action === "edit-room") {
                const room = state.rooms.find(function (r) { return Number(r.id) === id; });
                if (!room) return;
                editIdInput.value = String(room.id);
                numberInput.value = room.number;
                typeInput.value = room.type;
                statusInput.value = room.status;
                priceInput.value = String(room.price);
                submitBtn.textContent = "Update Room";
                cancelBtn.style.display = "inline-flex";
                return;
            }

            if (action === "delete-room") {
                if (!window.confirm("Delete this room?")) return;
                try {
                    await apiRequest("/rooms.php?id=" + id, { method: "DELETE" });
                    await refreshAllData();
                    resetForm();
                    showToast("Room deleted.");
                } catch (error) {
                    alert(error.message || "Failed to delete room.");
                }
            }
        });
    }

    function bindCustomers() {
        const form = document.getElementById("customerForm");
        const tableBody = document.getElementById("customersTableBody");
        const editIdInput = document.getElementById("customerEditId");
        const submitBtn = document.getElementById("customerSubmitBtn");
        const cancelBtn = document.getElementById("customerCancelBtn");
        const nameInput = document.getElementById("customerName");
        const emailInput = document.getElementById("customerEmail");
        const phoneInput = document.getElementById("customerPhone");
        const statusInput = document.getElementById("customerStatus");
        if (!form || !tableBody || !editIdInput || !submitBtn || !cancelBtn || !nameInput || !emailInput || !phoneInput || !statusInput) return;

        function resetForm() {
            form.reset();
            editIdInput.value = "";
            submitBtn.textContent = "Add Customer";
            cancelBtn.style.display = "none";
        }

        resetForm();
        const customersSearch = document.getElementById("customersSearch");
        const customersStatusFilter = document.getElementById("customersStatusFilter");
        if (customersSearch) customersSearch.addEventListener("input", renderCustomers);
        if (customersStatusFilter) customersStatusFilter.addEventListener("change", renderCustomers);

        form.addEventListener("submit", async function (event) {
            event.preventDefault();
            const payload = {
                id: Number(editIdInput.value || 0),
                name: nameInput.value.trim(),
                email: emailInput.value.trim().toLowerCase(),
                phone: phoneInput.value.trim(),
                status: statusInput.value
            };

            try {
                if (!payload.name || !payload.email || !payload.phone || !payload.status) {
                    throw new Error("Please fill all customer fields.");
                }
                if (payload.id > 0) {
                    await apiRequest("/customers.php", { method: "PUT", body: JSON.stringify(payload) });
                } else {
                    await apiRequest("/customers.php", { method: "POST", body: JSON.stringify(payload) });
                }
                await refreshAllData();
                resetForm();
                showToast(payload.id > 0 ? "Customer updated." : "Customer added.");
            } catch (error) {
                alert(error.message || "Failed to save customer.");
            }
        });

        cancelBtn.addEventListener("click", resetForm);

        tableBody.addEventListener("click", async function (event) {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            const action = target.dataset.action;
            const id = Number(target.dataset.id || 0);
            if (!action || id <= 0) return;

            if (action === "edit-customer") {
                const customer = state.customers.find(function (c) { return Number(c.id) === id; });
                if (!customer) return;
                editIdInput.value = String(customer.id);
                nameInput.value = customer.name;
                emailInput.value = customer.email;
                phoneInput.value = customer.phone;
                statusInput.value = customer.status;
                submitBtn.textContent = "Update Customer";
                cancelBtn.style.display = "inline-flex";
                return;
            }

            if (action === "delete-customer") {
                if (!window.confirm("Delete this customer?")) return;
                try {
                    await apiRequest("/customers.php?id=" + id, { method: "DELETE" });
                    await refreshAllData();
                    resetForm();
                    showToast("Customer deleted.");
                } catch (error) {
                    alert(error.message || "Failed to delete customer.");
                }
            }
        });
    }

    function bindBookings() {
        const form = document.getElementById("bookingForm");
        const tableBody = document.getElementById("bookingsTableBody");
        const editIdInput = document.getElementById("bookingEditId");
        const submitBtn = document.getElementById("bookingSubmitBtn");
        const cancelBtn = document.getElementById("bookingCancelBtn");
        const customerInput = document.getElementById("bookingCustomer");
        const roomInput = document.getElementById("bookingRoom");
        const checkInInput = document.getElementById("bookingCheckIn");
        const checkOutInput = document.getElementById("bookingCheckOut");
        if (!form || !tableBody || !editIdInput || !submitBtn || !cancelBtn || !customerInput || !roomInput || !checkInInput || !checkOutInput) return;

        function resetForm() {
            form.reset();
            editIdInput.value = "";
            submitBtn.textContent = "New Booking";
            cancelBtn.style.display = "none";
        }

        resetForm();
        const bookingsSearch = document.getElementById("bookingsSearch");
        if (bookingsSearch) bookingsSearch.addEventListener("input", renderBookings);

        form.addEventListener("submit", async function (event) {
            event.preventDefault();
            const payload = {
                dbId: Number(editIdInput.value || 0),
                customerId: Number(customerInput.value || 0),
                roomId: Number(roomInput.value || 0),
                checkIn: checkInInput.value,
                checkOut: checkOutInput.value
            };

            try {
                if (!payload.customerId || !payload.roomId || !payload.checkIn || !payload.checkOut) {
                    throw new Error("Please complete all booking fields.");
                }
                if (payload.checkOut <= payload.checkIn) {
                    throw new Error("Check-out must be after check-in.");
                }
                if (payload.dbId > 0) {
                    await apiRequest("/bookings.php", { method: "PUT", body: JSON.stringify(payload) });
                } else {
                    await apiRequest("/bookings.php", { method: "POST", body: JSON.stringify(payload) });
                }
                await refreshAllData();
                resetForm();
                showToast(payload.dbId > 0 ? "Booking updated." : "Booking created.");
            } catch (error) {
                alert(error.message || "Failed to save booking.");
            }
        });

        cancelBtn.addEventListener("click", resetForm);

        tableBody.addEventListener("click", async function (event) {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            const action = target.dataset.action;
            const dbId = Number(target.dataset.dbId || 0);
            if (!action || dbId <= 0) return;

            if (action === "edit-booking") {
                const booking = state.bookings.find(function (b) { return Number(b.dbId) === dbId; });
                if (!booking) return;
                updateBookingInputs();
                editIdInput.value = String(booking.dbId);
                customerInput.value = String(booking.customerId);
                roomInput.value = String(booking.roomId);
                checkInInput.value = booking.checkIn;
                checkOutInput.value = booking.checkOut;
                submitBtn.textContent = "Update Booking";
                cancelBtn.style.display = "inline-flex";
                return;
            }

            if (action === "delete-booking") {
                if (!window.confirm("Delete this booking?")) return;
                try {
                    await apiRequest("/bookings.php?dbId=" + dbId, { method: "DELETE" });
                    await refreshAllData();
                    resetForm();
                    showToast("Booking deleted.");
                } catch (error) {
                    alert(error.message || "Failed to delete booking.");
                }
            }
        });
    }

    function bindSettings() {
        const form = document.getElementById("settingsForm");
        const hotelNameInput = document.getElementById("settingsHotelName");
        const emailInput = document.getElementById("settingsContactEmail");
        const currencyInput = document.getElementById("settingsCurrency");
        const autoConfirmInput = document.getElementById("settingsAutoConfirm");
        const vipAlertsInput = document.getElementById("settingsVipAlerts");
        const maintenanceInput = document.getElementById("settingsMaintenanceReminders");
        if (!form || !hotelNameInput || !emailInput || !currencyInput || !autoConfirmInput || !vipAlertsInput || !maintenanceInput) return;

        hotelNameInput.value = state.settings.hotelName;
        emailInput.value = state.settings.contactEmail;
        currencyInput.value = state.settings.currency;
        autoConfirmInput.checked = !!state.settings.autoConfirmBookings;
        vipAlertsInput.checked = !!state.settings.vipArrivalAlerts;
        maintenanceInput.checked = !!state.settings.maintenanceReminders;

        form.addEventListener("submit", async function (event) {
            event.preventDefault();
            const payload = {
                hotelName: hotelNameInput.value.trim(),
                contactEmail: emailInput.value.trim().toLowerCase(),
                currency: currencyInput.value,
                autoConfirmBookings: autoConfirmInput.checked,
                vipArrivalAlerts: vipAlertsInput.checked,
                maintenanceReminders: maintenanceInput.checked
            };

            try {
                const data = await apiRequest("/settings.php", { method: "PUT", body: JSON.stringify(payload) });
                state.settings = data.item || state.settings;
                applyGlobalSettings();
                showToast("Settings saved.");
            } catch (error) {
                alert(error.message || "Failed to save settings.");
            }
        });
    }

    function bindSidebarToggle() {
        const toggleBtn = document.getElementById("toggleSidebar");
        const sidebar = document.querySelector(".sidebar");
        if (!toggleBtn || !sidebar) return;
        toggleBtn.addEventListener("click", function () {
            if (window.matchMedia("(max-width: 900px)").matches) {
                sidebar.classList.toggle("mobile-open");
            } else {
                sidebar.classList.toggle("collapsed");
            }
        });
    }

    async function init() {
        bindSidebarToggle();
        renderDateTime();
        setInterval(renderDateTime, 30000);

        try {
            await loadAllData();
        } catch (error) {
            alert("Backend connection failed. Check MySQL and API setup.");
            return;
        }

        renderRooms();
        renderCustomers();
        updateBookingInputs();
        renderBookings();
        renderDashboard();
        bindRooms();
        bindCustomers();
        bindBookings();
        bindSettings();
    }

    init();
})();

