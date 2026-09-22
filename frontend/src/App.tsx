import { Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import AuthGate from "@/components/AuthGate";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AuthGate><Home /></AuthGate>} />
    </Routes>
  );
}
