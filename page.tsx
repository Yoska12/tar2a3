import React, { useEffect, useState } from 'react';
import { supabase } from './src/lib/supabase';

interface Todo {
  id: string | number;
  name?: string;
  title?: string;
  [key: string]: any;
}

export default function Page() {
  const [todos, setTodos] = useState<Todo[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchTodos() {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error: supabaseError } = await supabase
          .from('todos')
          .select();

        if (supabaseError) {
          throw supabaseError;
        }

        if (isMounted) {
          setTodos(data || []);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Error fetching todos:', err);
          setError(err.message || 'حدث خطأ أثناء جلب البيانات من الخادم');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchTodos();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px] p-6 text-slate-500 font-cairo">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span>جاري تحميل البيانات...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 m-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-center font-cairo">
        <p className="font-bold text-sm mb-1">تعذر تحميل البيانات</p>
        <p className="text-xs">{error}</p>
      </div>
    );
  }

  return (
    <main className="max-w-2xl mx-auto p-6 font-cairo" dir="rtl">
      <h1 className="text-xl font-black mb-4 text-slate-900 dark:text-white">قائمة المهام (Todos)</h1>
      {todos && todos.length > 0 ? (
        <ul className="space-y-2">
          {todos.map((todo) => (
            <li
              key={todo.id}
              className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm shadow-sm"
            >
              {todo.name || todo.title || `عنصر رقم ${todo.id}`}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-400">لا توجد عناصر لعرضها حالياً.</p>
      )}
    </main>
  );
}
