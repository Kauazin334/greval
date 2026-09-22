import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiGet, apiPost } from '@/lib/api';

type SessionUser = { username: string; role: string };

export default function AuthGate({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const session = useQuery({ queryKey: ['session'], queryFn: () => apiGet<SessionUser>('/auth/me'), retry: false });
  if (session.isLoading) return <main className='grid min-h-svh place-items-center bg-slate-950 text-slate-100'>Verificando acesso seguro...</main>;
  if (session.data) return <>{children}</>;
  return <Login onSuccess={() => queryClient.invalidateQueries({ queryKey: ['session'] })} error={session.error} />;
}

function Login({ onSuccess, error }: { onSuccess: () => void; error: Error | null }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setMessage('');
    try {
      await apiPost<SessionUser>('/auth/login', { username, password });
      setPassword('');
      onSuccess();
    } catch (err) {
      setMessage(err instanceof ApiError && err.status === 429 ? 'Muitas tentativas. Aguarde antes de tentar novamente.' : 'Usuário ou senha inválidos.');
    } finally {
      setSending(false);
    }
  }

  return <main className='grid min-h-svh place-items-center bg-slate-950 p-6 text-slate-100'>
    <form onSubmit={submit} className='w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-7 shadow-2xl'>
      <h1 className='text-2xl font-bold'>GREVAL</h1>
      <p className='mt-2 text-sm text-slate-400'>Acesso restrito à equipe autorizada.</p>
      <label className='mt-6 block text-sm'>Usuário<input required autoComplete='username' value={username} onChange={(event) => setUsername(event.target.value)} className='mt-1 w-full rounded border border-slate-600 bg-slate-950 p-2' /></label>
      <label className='mt-4 block text-sm'>Senha<input required type='password' autoComplete='current-password' value={password} onChange={(event) => setPassword(event.target.value)} className='mt-1 w-full rounded border border-slate-600 bg-slate-950 p-2' /></label>
      <button disabled={sending} className='mt-6 w-full rounded bg-amber-400 p-2 font-bold text-slate-950 disabled:opacity-50'>{sending ? 'Entrando...' : 'Entrar'}</button>
      {(message || error) && <p className='mt-4 text-sm text-red-300'>{message || 'Não foi possível verificar a sessão.'}</p>}
    </form>
  </main>;
}
