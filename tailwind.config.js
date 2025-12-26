/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                handball: {
                    blue: '#004E92',
                    orange: '#FF6B35',
                    court: '#E8F1F5',
                    area: '#F4D35E',
                }
            }
        },
    },
    plugins: [],
}
