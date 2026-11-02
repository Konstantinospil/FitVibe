#!/bin/bash
set -e

# FitVibe Kubernetes Setup Script
# This script sets up all Kubernetes resources in the correct order

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Setting up FitVibe Kubernetes resources..."
echo ""

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is not installed. Please install kubectl first."
    exit 1
fi

# Check if cluster is accessible
if ! kubectl cluster-info &> /dev/null; then
    echo "⚠️  Warning: Cannot connect to Kubernetes cluster"
    echo "   Please ensure you have a cluster running and kubectl is configured."
    echo "   For local development, you can use:"
    echo "   - Docker Desktop (enable Kubernetes)"
    echo "   - minikube start"
    echo "   - kind create cluster"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "📦 Step 1: Creating namespace..."
kubectl apply -f namespace.yaml
echo "✓ Namespace created"
echo ""

echo "💾 Step 2: Checking cluster storage..."
echo "AWS-specific storage-class placeholder removed. Configure an independently verified encrypted StorageClass for the actual cluster."
echo ""

echo "🔐 Step 3: Checking secrets..."
if [ ! -f "secrets.yaml" ]; then
    echo "⚠️  secrets.yaml not found!"
    echo "   Creating from template. Please edit secrets.yaml with actual values."
    cp secrets-template.yaml secrets.yaml
    echo "   IMPORTANT: Edit secrets.yaml with your actual secrets before continuing!"
    echo ""
    read -p "Have you edited secrets.yaml with actual values? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Please edit secrets.yaml and run this script again."
        exit 1
    fi
fi
kubectl apply -f secrets.yaml
echo "✓ Secrets created"
echo ""

echo "⚙️  Step 4: Creating ConfigMap..."
kubectl apply -f configmap.yaml
echo "✓ ConfigMap created"
echo ""

echo "🗄️  Step 5: Deploying PostgreSQL..."
kubectl apply -f postgres-deployment.yaml
echo "✓ PostgreSQL deployment created"
echo "   Waiting for PostgreSQL to be ready..."
kubectl wait --for=condition=ready pod -l app=postgres -n fitvibe --timeout=300s || true
echo ""

echo "📦 Step 6: Deploying Redis (optional but recommended)..."
read -p "Deploy Redis? (Y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    kubectl apply -f redis-deployment.yaml
    echo "✓ Redis deployment created"
    echo "   Waiting for Redis to be ready..."
    kubectl wait --for=condition=ready pod -l app=redis -n fitvibe --timeout=300s || true
else
    echo "⏭️  Skipping Redis deployment"
    echo "   Note: Backend will use in-memory cache and queues"
fi
echo ""

echo "🔧 Step 7: Deploying Backend..."
kubectl apply -f backend-deployment.yaml
echo "✓ Backend deployment created"
echo ""

echo "🎨 Step 8: Deploying Frontend..."
kubectl apply -f frontend-deployment.yaml
echo "✓ Frontend deployment created"
echo ""

echo "🌐 Step 9: Creating Ingress..."
kubectl apply -f ingress.yaml
echo "✓ Ingress created"
echo ""

echo "⏳ Waiting for all pods to be ready..."
kubectl wait --for=condition=ready pod -l app=fitvibe-backend -n fitvibe --timeout=300s || true
kubectl wait --for=condition=ready pod -l app=frontend -n fitvibe --timeout=300s || true

echo ""
echo "✅ Setup complete!"
echo ""
echo "📊 Current status:"
kubectl get pods -n fitvibe
echo ""
echo "🔍 Useful commands:"
echo "   kubectl get pods -n fitvibe                    # View all pods"
echo "   kubectl logs -f deployment/fitvibe-backend -n fitvibe  # Backend logs"
echo "   kubectl logs -f deployment/frontend -n fitvibe         # Frontend logs"
echo "   kubectl get ingress -n fitvibe                  # View ingress"
echo "   kubectl port-forward svc/fitvibe-backend 4000:4000 -n fitvibe  # Port forward backend"
echo ""

