import { motion } from 'motion/react';
import type { PlantData } from '../store';

type Props = {
  plant: PlantData;
};

export default function HistoryScreen({ plant }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="px-6 pb-6 space-y-6 pt-2"
    >
      <div className="grid grid-cols-3 gap-3">
        {plant.checkIns?.map((checkIn, i) => (
          <div key={i} className="aspect-square rounded-[var(--radius-dynamic)] overflow-hidden relative dynamic-border">
            <img
              src={checkIn.imageUrl}
              alt=""
              className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
            />
            <div className="absolute bottom-2 left-2 right-2 bg-black/60 backdrop-blur px-2 py-1 rounded text-[10px] text-white font-medium text-center">
              {checkIn.dateId}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
