// ==========================================
// STUDYHUB - DARK / LIGHT MODE
// ==========================================

const themeToggle = document.getElementById("themeToggle");


// ==========================================
// LOAD SAVED THEME
// ==========================================

const savedTheme = localStorage.getItem("studyhub-theme");

if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
}


// ==========================================
// UPDATE BUTTON
// ==========================================

function updateThemeButton() {

    if (!themeToggle) {
        return;
    }

    if (document.body.classList.contains("dark-mode")) {

        themeToggle.textContent = "☀️ Light Mode";

    } else {

        themeToggle.textContent = "🌙 Dark Mode";
    }
}


// Run when page loads
updateThemeButton();


// ==========================================
// TOGGLE DARK / LIGHT MODE
// ==========================================

if (themeToggle) {

    themeToggle.addEventListener("click", function () {

        document.body.classList.toggle("dark-mode");


        const darkMode =
            document.body.classList.contains("dark-mode");


        if (darkMode) {

            localStorage.setItem(
                "studyhub-theme",
                "dark"
            );

        } else {

            localStorage.setItem(
                "studyhub-theme",
                "light"
            );
        }


        updateThemeButton();

    });
}