import { Route, Routes } from 'react-router-dom';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { Home } from '@/routes/Home';
import { ServiceDetail } from '@/routes/ServiceDetail';
import { Fees } from '@/routes/Fees';
import { Book } from '@/routes/Book';
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
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
