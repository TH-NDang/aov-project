import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import { useBeforeUnload } from "react-router"
export interface BackgroundTask {
  id: string
  title: string
  path: string
  status: "running" | "review" | "completed" | "error"
  description: string
  completed: number
  total: number
}
interface TasksContext {
  tasks: BackgroundTask[]
  updateTask: (task: BackgroundTask) => void
}
const Context = createContext<TasksContext | null>(null)
export function BackgroundTasksProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<BackgroundTask[]>([])
  const updateTask = useCallback(
    (task: BackgroundTask) =>
      setTasks((current) => {
        const index = current.findIndex((item) => item.id === task.id)
        if (index < 0) return [...current, task]
        return current.map((item) => (item.id === task.id ? task : item))
      }),
    [],
  )
  useBeforeUnload((event) => {
    if (tasks.some((task) => task.status === "running")) {
      event.preventDefault()
      event.returnValue = ""
    }
  })
  const value = useMemo(() => ({ tasks, updateTask }), [tasks, updateTask])
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export function useBackgroundTasks() {
  const value = useContext(Context)
  if (!value) throw new Error("Background tasks require BackgroundTasksProvider.")
  return value
}
