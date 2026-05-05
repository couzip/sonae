import { MapHost } from '@/components/map/MapHost';
import { ScreenRouter } from '@/components/screens/ScreenRouter';

export default function Home() {
  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <MapHost />
      <ScreenRouter />
    </main>
  );
}
