import { TeamMember } from '@/types/construction';

export const DEFAULT_CAPACITY_HOURS_PER_WEEK = 48;

export const getMemberCapacityHours = (member?: Pick<TeamMember, 'capacityHoursPerWeek'> | null) =>
  member?.capacityHoursPerWeek ?? DEFAULT_CAPACITY_HOURS_PER_WEEK;
