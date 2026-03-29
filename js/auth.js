(function () {
    const REQUIRE_AUTH = true;

    function isAuthPage() {
        return window.location.pathname.toLowerCase().includes("/auth/");
    }

    function apiBase() {
        return isAuthPage() ? "../api" : "api";
    }

    function toLoginPage() {
        window.location.href = isAuthPage() ? "login.html" : "auth/login.html";
    }

    function toDashboard() {
        window.location.href = isAuthPage() ? "../index.html" : "index.html";
    }

    async function apiRequest(path, options) {
        let response;
        try {
            response = await fetch(apiBase() + path, {
                method: "GET",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                ...options
            });
        } catch (error) {
            throw new Error("Cannot reach backend API. Open project via localhost/Laragon, not file://");
        }

        let data = {};
        try {
            data = await response.json();
        } catch (error) {
            data = {};
        }

        if (!response.ok) {
            const message = data.message || "Request failed.";
            throw new Error(message);
        }
        return data;
    }

    async function handleLogin(form) {
        form.addEventListener("submit", async function (event) {
            event.preventDefault();
            const email = document.getElementById("loginEmail").value.trim().toLowerCase();
            const password = document.getElementById("loginPassword").value;

            try {
                await apiRequest("/auth/login.php", {
                    method: "POST",
                    body: JSON.stringify({ email: email, password: password })
                });
                toDashboard();
            } catch (error) {
                alert(error.message || "Invalid email or password.");
            }
        });
    }

    async function handleRegister(form) {
        form.addEventListener("submit", async function (event) {
            event.preventDefault();
            const name = document.getElementById("registerName").value.trim();
            const email = document.getElementById("registerEmail").value.trim().toLowerCase();
            const password = document.getElementById("registerPassword").value;

            try {
                await apiRequest("/auth/register.php", {
                    method: "POST",
                    body: JSON.stringify({ name: name, email: email, password: password })
                });
                toDashboard();
            } catch (error) {
                alert(error.message || "Registration failed.");
            }
        });
    }

    async function bindLogout() {
        const links = document.querySelectorAll(".logout-link");
        if (!links.length) return;
        links.forEach(function (link) {
            link.addEventListener("click", async function (event) {
                event.preventDefault();
                try {
                    await apiRequest("/auth/logout.php", { method: "POST" });
                } catch (error) {
                    // Proceed to login even if API call fails.
                }
                toLoginPage();
            });
        });
    }

    async function enforceAuth() {
        const protectedPage = document.body.dataset.protected === "true";
        if (!REQUIRE_AUTH && !isAuthPage()) return;

        try {
            const me = await apiRequest("/auth/me.php");
            const authenticated = !!me.authenticated;
            if (REQUIRE_AUTH && protectedPage && !authenticated) {
                toLoginPage();
                return;
            }
            if (REQUIRE_AUTH && isAuthPage() && authenticated) {
                toDashboard();
            }
        } catch (error) {
            if (REQUIRE_AUTH && protectedPage) {
                toLoginPage();
            }
        }
    }

    (async function init() {
        const loginForm = document.getElementById("loginForm");
        const registerForm = document.getElementById("registerForm");

        if (loginForm) {
            await handleLogin(loginForm);
        }
        if (registerForm) {
            await handleRegister(registerForm);
        }

        await bindLogout();
        await enforceAuth();
    })();
})();
