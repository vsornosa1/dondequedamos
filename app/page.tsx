import Planner from '@/components/Planner';

export default function Home() {
  const freeRouting = Boolean(process.env.OSRM_WALK_URL || process.env.OSRM_BIKE_URL || process.env.OSRM_CAR_URL || process.env.OTP_URL);
  return <Planner freeRouting={freeRouting} />;
}
