type TabKey = "requests" | "chats" | "profile";

type MobileBottomNavProps = {
  activeTab: TabKey;
  onChange: (tab: TabKey) => void;
  requestBadge?: number;
};

const items: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: "requests", label: "Заявки", icon: "◉" },
  { key: "chats", label: "Чаты", icon: "◔" },
  { key: "profile", label: "Профиль", icon: "◎" },
];

export function MobileBottomNav({ activeTab, onChange, requestBadge = 0 }: MobileBottomNavProps) {
  return (
    <nav className="sticky bottom-0 z-20 border-t border-white/5 bg-[#0b0b0c] px-4 py-3">
      <div className="grid grid-cols-3 gap-3">
        {items.map((item) => {
          const isActive = item.key === activeTab;
          const badgeValue = item.key === "requests" ? requestBadge : 0;
          return (
            <button
              key={item.key}
              className={`relative flex flex-col items-center justify-center rounded-2xl px-3 py-3 transition ${
                isActive ? "bg-white/10 text-white" : "text-zinc-500 hover:text-white"
              }`}
              onClick={() => onChange(item.key)}
              type="button"
            >
              {badgeValue > 0 ? (
                <span className="absolute right-3 top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-[10px] font-semibold text-zinc-950">
                  {badgeValue}
                </span>
              ) : null}
              <span className="text-lg leading-none">{item.icon}</span>
              <span className="mt-1 text-[11px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
