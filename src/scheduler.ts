interface Task {
  id: string;
  cron: string;
  handler: () => Promise<unknown>;
}

export class Scheduler {
  private tasks = new Map<string, Task>();

  registerTask(id: string, cron: string, handler: () => Promise<unknown>): void {
    this.tasks.set(id, { id, cron, handler });
  }

  cancelTask(id: string): void {
    this.tasks.delete(id);
  }

  listTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  async execute(id: string): Promise<unknown> {
    const task = this.tasks.get(id);
    if (!task) throw new Error(`Task '${id}' not found`);
    return task.handler();
  }
}
