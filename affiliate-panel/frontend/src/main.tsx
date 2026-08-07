import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App';
import './index.css';

/**
 * `HashRouter`: panel statik dosya olarak servis ediliyor ve derin bir
 * adrese doğrudan girildiğinde sunucunun her yolu `index.html`'e
 * yönlendirmesi gerekir. Hash yönlendirmesi bu yapılandırmayı
 * gereksiz kılıyor — yanlış kurulmuş bir sunucuda "yenileyince 404"
 * hatası hiç oluşmuyor.
 */
createRoot(document.getElementById('kok')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
