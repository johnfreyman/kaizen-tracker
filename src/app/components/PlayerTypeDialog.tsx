interface PlayerTypeDialogProps {
  playerName: string;
  onSelect: (isGuest: boolean) => void;
  onCancel: () => void;
}

export default function PlayerTypeDialog({
  playerName,
  onSelect,
  onCancel,
}: PlayerTypeDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-xl font-bold text-gray-900">Add {playerName}</h3>
        <p className="mt-2 text-sm text-gray-600">
          Choose how this player should be listed.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onSelect(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 font-bold text-white transition-all hover:bg-gray-800 focus:ring-4 focus:ring-gray-300"
          >
            <span aria-hidden="true">🏀</span>
            Guest
          </button>
          <button
            type="button"
            onClick={() => onSelect(false)}
            className="rounded-xl bg-blue-600 px-4 py-3 font-bold text-white transition-all hover:bg-blue-700 focus:ring-4 focus:ring-blue-200"
          >
            Kaizen Player
          </button>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="mt-3 w-full rounded-xl px-4 py-2 text-sm font-semibold text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
