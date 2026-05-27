import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { RequisitionDetail } from './pages/RequisitionDetail';

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/requisitions/:id" element={<RequisitionDetail />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}
