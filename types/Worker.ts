/**
 * Role - Worker role enumeration
 */
export enum Role {
  WORKER = 'WORKER',
  OWNER = 'OWNER',
}

/**
 * Worker - Factory floor staff member
 */
export interface Worker {
  /** Unique identifier (CUID) */
  id: string;

  /** Worker's display name */
  name: string;

  /** Unique PIN for login/authentication */
  pin: string;

  /** Role in the system (WORKER or OWNER) */
  role: Role;

  /** When the worker was created */
  createdAt: Date;

  /** IDs of progress logs submitted by this worker */
  progressLogIds: string[];

  /** IDs of batch assignments for this worker */
  assignmentIds: string[];

  /** IDs of shifts worked by this worker */
  shiftIds: string[];
}
