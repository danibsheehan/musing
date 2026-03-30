import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import HomeRedirect from "./components/HomeRedirect";
import PageView from "./components/PageView";
import "./App.css";

function App() {
  return (
    <main className="app">
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HomeRedirect />} />
          <Route path="page/:pageId" element={<PageView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </main>
  );
}

export default App;
