import { useParams } from "react-router-dom";

export function ChatPage() {
  const { chatId } = useParams();

  return (
    <div className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-5xl flex-col p-4 md:p-6">
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-lg font-semibold">Чат #{chatId}</h2>
        <p className="mt-2 text-sm text-zinc-400">
          На следующем шаге сюда будет подключена история сообщений, composer и realtime через WebSocket.
        </p>
      </div>
    </div>
  );
}
