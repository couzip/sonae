'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useFlowStore } from '@/stores/useFlowStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { useResearchStore } from '@/stores/useResearchStore';
import { PlacePickerScreen } from './PlacePickerScreen';
import { ResearchScreen } from './ResearchScreen';
import { DisasterGridScreen } from './DisasterGridScreen';
import { NextActionsScreen } from './NextActionsScreen';

const SCREENS = {
  pick: PlacePickerScreen,
  research: ResearchScreen,
  grid: DisasterGridScreen,
  detail: DisasterGridScreen,
  actions: NextActionsScreen,
} as const;

export function ScreenRouter() {
  const phase = useFlowStore((s) => s.phase);
  const setPhase = useFlowStore((s) => s.setPhase);
  const municipality = useLocationStore((s) => s.municipality);
  const result = useResearchStore((s) => s.result);

  useEffect(() => {
    if (phase === 'detail') {
      setPhase('grid');
      return;
    }
    if ((phase === 'research' || phase === 'grid' || phase === 'actions') && !municipality) {
      setPhase('pick');
      return;
    }
    if ((phase === 'grid' || phase === 'actions') && !result) {
      setPhase('research');
    }
  }, [phase, municipality, result, setPhase]);

  const Screen = SCREENS[phase];

  const passThrough = phase === 'pick';

  return (
    <AnimatePresence>
      <motion.div
        key={phase}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className={`absolute inset-0 h-full w-full ${passThrough ? 'pointer-events-none' : ''}`}
      >
        <Screen />
      </motion.div>
    </AnimatePresence>
  );
}
