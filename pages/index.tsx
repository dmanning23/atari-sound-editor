import { useState } from 'react';
import type { NextPage } from 'next';
import AtariSoundEditor from '../components/atari-sound-editor';
import AtariMusicEditor from '../components/atari-music-editor';

type Tab = 'sfx' | 'music';

const Home: NextPage = () => {
    const [activeTab, setActiveTab] = useState<Tab>('sfx');

    return (
        <main className="h-screen flex flex-col overflow-hidden">
            {/* Tab bar */}
            <div className="flex-shrink-0 flex items-center gap-0 bg-gray-900 border-b border-gray-700 px-3">
                <TabButton
                    label="♪ Sound Effects"
                    active={activeTab === 'sfx'}
                    onClick={() => setActiveTab('sfx')}
                    lightTheme
                />
                <TabButton
                    label="♫ Music"
                    active={activeTab === 'music'}
                    onClick={() => setActiveTab('music')}
                />
            </div>

            {/* Editor panel */}
            <div className="flex-1 min-h-0 overflow-hidden">
                {activeTab === 'sfx' && (
                    <div className="h-full overflow-auto bg-gray-50">
                        <AtariSoundEditor />
                    </div>
                )}
                {activeTab === 'music' && (
                    <div className="h-full overflow-hidden">
                        <AtariMusicEditor />
                    </div>
                )}
            </div>
        </main>
    );
};

function TabButton({
    label,
    active,
    onClick,
    lightTheme = false,
}: {
    label: string;
    active: boolean;
    onClick: () => void;
    lightTheme?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            className={[
                'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                active
                    ? lightTheme
                        ? 'border-indigo-500 text-white bg-gray-800'
                        : 'border-indigo-500 text-white bg-gray-800'
                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800',
            ].join(' ')}
        >
            {label}
        </button>
    );
}

export default Home;
