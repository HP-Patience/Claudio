import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Scheduler } from '../src/scheduler.js';

describe('Scheduler', () => {
  let scheduler: Scheduler;

  beforeEach(() => {
    scheduler = new Scheduler();
  });

  it('registers a task and tracks it in task list', () => {
    const handler = vi.fn();
    scheduler.registerTask('morning-plan', '0 7 * * *', handler);

    expect(scheduler.listTasks()).toHaveLength(1);
    expect(scheduler.listTasks()[0].id).toBe('morning-plan');
  });

  it('runs a registered task via execute', async () => {
    const handler = vi.fn().mockResolvedValue('done');
    scheduler.registerTask('morning-plan', '0 7 * * *', handler);

    await scheduler.execute('morning-plan');

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('throws on executing unknown task', async () => {
    await expect(scheduler.execute('nonexistent')).rejects.toThrow('not found');
  });

  it('cancels a registered task', () => {
    scheduler.registerTask('morning-plan', '0 7 * * *', vi.fn());
    scheduler.cancelTask('morning-plan');

    expect(scheduler.listTasks()).toHaveLength(0);
  });

  it('registerTask replaces existing task with same id', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    scheduler.registerTask('t1', '0 7 * * *', h1);
    scheduler.registerTask('t1', '0 8 * * *', h2);

    expect(scheduler.listTasks()).toHaveLength(1);
    expect(scheduler.listTasks()[0].cron).toBe('0 8 * * *');
  });
});
