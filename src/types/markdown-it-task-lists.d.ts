declare module 'markdown-it-task-lists' {
  import type { PluginWithOptions } from 'markdown-it';

  interface TaskListsOptions {
    /** Render disabled checkboxes as enabled. Default false. */
    enabled?: boolean;
    /** Wrap labels around checkboxes. Default false. */
    label?: boolean;
    /** Add data-line attribute. Default false. */
    lineNumber?: boolean;
  }

  const taskLists: PluginWithOptions<TaskListsOptions>;
  export default taskLists;
}
