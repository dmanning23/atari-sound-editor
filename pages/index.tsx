import type { NextPage } from 'next';
import AtariSoundEditor from '../components/atari-sound-editor';

const Home: NextPage = () => {
    return (
        <main className="min-h-screen bg-gray-50">
            <AtariSoundEditor />
        </main>
    );
};

export default Home;