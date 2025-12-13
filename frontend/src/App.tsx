import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { UploadScreen } from './screens/UploadScreen';
import { SetupScreen } from './screens/SetupScreen';
import { ProcessScreen } from './screens/ProcessScreen';
import { ReviewScreen } from './screens/ReviewScreen';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/upload" replace />} />
        <Route path="/upload" element={<UploadScreen />} />
        <Route path="/setup" element={<SetupScreen />} />
        <Route path="/process" element={<ProcessScreen />} />
        <Route path="/review" element={<ReviewScreen />} />
      </Routes>
    </Layout>
  );
}

export default App;