'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useFlowStore } from '@/stores/useFlowStore';
import { PlacePickerScreen } from './PlacePickerScreen';
import { ResearchScreen } from './ResearchScreen';
import { DisasterGridScreen } from './DisasterGridScreen';
import { DisasterDetailScreen } from './DisasterDetailScreen';
import { NextActionsScreen } from './NextActionsScreen';

const SCREENS = {
  pick: PlacePickerScreen,
  research: ResearchScreen,
  grid: DisasterGridScreen,
  detail: DisasterDetailScreen,
  actions: NextActionsScreen,
} as const;

export function ScreenRouter() {
  const phase = useFlowStore((s) => s.phase);
  const Screen = SCREENS[phase];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={phase}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
        className="relative h-full w-full"
      >
        <Screen />
      </motion.div>
    </AnimatePresence>
  );
}
