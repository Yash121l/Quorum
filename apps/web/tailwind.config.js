/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        leader: "#f97316",
        candidate: "#eab308",
        follower: "#3b82f6",
        replica: "#a855f7",
        partition: "#ef4444",
      },
    },
  },
  plugins: [],
};
