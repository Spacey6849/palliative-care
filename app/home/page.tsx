import { HomeClient } from './HomeClient';

// Server component wrapper (prevents production misclassification of the page as a server component calling a client hook directly)
export default function HomePage() {
  return <HomeClient />;
}
