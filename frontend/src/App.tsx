import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import Home from './pages/Home';
import ResearchList from './pages/ResearchList';
import ResearchDetail from './pages/ResearchDetail';
import PolicyList from './pages/PolicyList';
import PolicyDetail from './pages/PolicyDetail';
import RecoveryList from './pages/RecoveryList';
import SourceList from './pages/SourceList';
import SourceCalendar from './pages/SourceCalendar';
import ReportList from './pages/ReportList';
import ReportDetail from './pages/ReportDetail';
import {
  AdminLogin,
  AdminDashboard,
  AdminResearch,
  AdminPolicy,
  AdminRecovery,
  AdminTags,
} from './pages/admin';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        {/* 공개 페이지 */}
        <Route
          path="/"
          element={
            <Layout>
              <Home />
            </Layout>
          }
        />
        <Route
          path="/research"
          element={
            <Layout>
              <ResearchList />
            </Layout>
          }
        />
        <Route
          path="/research/:id"
          element={
            <Layout>
              <ResearchDetail />
            </Layout>
          }
        />
        <Route
          path="/policy"
          element={
            <Layout>
              <PolicyList />
            </Layout>
          }
        />
        <Route
          path="/policy/:id"
          element={
            <Layout>
              <PolicyDetail />
            </Layout>
          }
        />
        <Route
          path="/recovery"
          element={
            <Layout>
              <RecoveryList />
            </Layout>
          }
        />
        <Route
          path="/sources"
          element={
            <Layout>
              <SourceList />
            </Layout>
          }
        />
        <Route
          path="/calendar"
          element={
            <Layout>
              <SourceCalendar />
            </Layout>
          }
        />
        <Route
          path="/reports"
          element={
            <Layout>
              <ReportList />
            </Layout>
          }
        />
        <Route
          path="/reports/:id"
          element={
            <Layout>
              <ReportDetail />
            </Layout>
          }
        />

        {/* Admin 페이지 */}
        <Route
          path="/admin/login"
          element={
            <AdminLayout>
              <AdminLogin />
            </AdminLayout>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminLayout>
              <AdminDashboard />
            </AdminLayout>
          }
        />
        <Route
          path="/admin/research"
          element={
            <AdminLayout>
              <AdminResearch />
            </AdminLayout>
          }
        />
        <Route
          path="/admin/policy"
          element={
            <AdminLayout>
              <AdminPolicy />
            </AdminLayout>
          }
        />
        <Route
          path="/admin/recovery"
          element={
            <AdminLayout>
              <AdminRecovery />
            </AdminLayout>
          }
        />
        <Route
          path="/admin/tags"
          element={
            <AdminLayout>
              <AdminTags />
            </AdminLayout>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
