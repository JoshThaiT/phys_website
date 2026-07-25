import { Route, Routes } from 'react-router-dom';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { RequireAdmin } from '@/components/RequireAdmin';
import { Home } from '@/routes/Home';
import { ServiceDetail } from '@/routes/ServiceDetail';
import { Fees } from '@/routes/Fees';
import { Book } from '@/routes/Book';
import { AdminSignIn } from '@/routes/AdminSignIn';
import { AdminCallback } from '@/routes/AdminCallback';
import { AdminRequests } from '@/routes/AdminRequests';
import { AdminRequestDetail } from '@/routes/AdminRequestDetail';
import { NotFound } from '@/routes/NotFound';

export function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="skip-link">Skip to content</a>
      <Nav />
      <main id="main" className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/services/:slug" element={<ServiceDetail />} />
          <Route path="/fees" element={<Fees />} />
          <Route path="/book" element={<Book />} />
          <Route path="/admin" element={<AdminSignIn />} />
          <Route path="/admin/callback" element={<AdminCallback />} />
          <Route
            path="/admin/requests"
            element={
              <RequireAdmin>
                <AdminRequests />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/requests/:id"
            element={
              <RequireAdmin>
                <AdminRequestDetail />
              </RequireAdmin>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
