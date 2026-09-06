#!/bin/bash

# Canary Deployment Promotion Script
# This script promotes a canary deployment to production

set -e

NAMESPACE="calqulusrms"
CANARY_DEPLOYMENT="calqulusrms-canary"
STABLE_DEPLOYMENT="calqulusrms"
CANARY_SERVICE="calqulusrms-canary"
STABLE_SERVICE="calqulusrms"
CANARY_INGRESS="calqulusrms-canary-ingress"

# Function to deploy canary
deploy_canary() {
    echo "Deploying canary version..."
    
    # Apply canary deployment
    kubectl apply -f canary-deployment.yaml -n $NAMESPACE
    
    # Apply canary service
    kubectl apply -f canary-service.yaml -n $NAMESPACE
    
    # Apply canary ingress with 10% traffic
    kubectl apply -f canary-ingress.yaml -n $NAMESPACE
    
    echo "Canary deployed with 10% traffic"
}

# Function to increase canary traffic
increase_canary_traffic() {
    PERCENTAGE=$1
    echo "Increasing canary traffic to $PERCENTAGE%..."
    
    # Update canary ingress annotation
    kubectl annotate ingress $CANARY_INGRESS -n $NAMESPACE \
        nginx.ingress.kubernetes.io/canary-weight="$PERCENTAGE" \
        --overwrite
    
    echo "Canary traffic increased to $PERCENTAGE%"
}

# Function to promote canary to stable
promote_canary() {
    echo "Promoting canary to stable deployment..."
    
    # Get canary image
    CANARY_IMAGE=$(kubectl get deployment $CANARY_DEPLOYMENT -n $NAMESPACE -o jsonpath='{.spec.template.spec.containers[0].image}')
    
    # Update stable deployment with canary image
    kubectl set image deployment $STABLE_DEPLOYMENT -n $NAMESPACE \
        calqulusrms=$CANARY_IMAGE
    
    # Wait for stable deployment to be ready
    kubectl rollout status deployment $STABLE_DEPLOYMENT -n $NAMESPACE --timeout=5m
    
    # Remove canary ingress
    kubectl delete ingress $CANARY_INGRESS -n $NAMESPACE --ignore-not-found=true
    
    # Scale down canary deployment
    kubectl scale deployment $CANARY_DEPLOYMENT -n $NAMESPACE --replicas=0
    
    echo "Canary promoted to stable successfully"
}

# Function to rollback canary
rollback_canary() {
    echo "Rolling back canary deployment..."
    
    # Remove canary ingress
    kubectl delete ingress $CANARY_INGRESS -n $NAMESPACE --ignore-not-found=true
    
    # Scale down canary deployment
    kubectl scale deployment $CANARY_DEPLOYMENT -n $NAMESPACE --replicas=0
    
    echo "Canary rolled back successfully"
}

# Function to verify canary health
verify_canary() {
    echo "Verifying canary deployment health..."
    
    # Check if canary pods are ready
    READY_PODS=$(kubectl get deployment $CANARY_DEPLOYMENT -n $NAMESPACE -o jsonpath='{.status.readyReplicas}')
    DESIRED_PODS=$(kubectl get deployment $CANARY_DEPLOYMENT -n $NAMESPACE -o jsonpath='{.spec.replicas}')
    
    if [ "$READY_PODS" -eq "$DESIRED_PODS" ]; then
        echo "Canary deployment is healthy: $READY_PODS/$DESIRED_PODS pods ready"
        return 0
    else
        echo "Canary deployment is not healthy: $READY_PODS/$DESIRED_PODS pods ready"
        return 1
    fi
}

# Function to monitor canary metrics
monitor_canary() {
    echo "Monitoring canary metrics..."
    
    # Check error rates
    echo "Checking error rates..."
    # In production, this would query metrics from Prometheus/Grafana
    
    # Check latency
    echo "Checking latency..."
    # In production, this would query metrics from Prometheus/Grafana
    
    echo "Canary metrics monitoring complete"
}

# Main script logic
case "$1" in
    deploy)
        deploy_canary
        verify_canary
        ;;
    increase)
        if [ -z "$2" ]; then
            echo "Usage: $0 increase <percentage>"
            exit 1
        fi
        increase_canary_traffic $2
        ;;
    promote)
        verify_canary
        monitor_canary
        promote_canary
        ;;
    rollback)
        rollback_canary
        ;;
    verify)
        verify_canary
        ;;
    monitor)
        monitor_canary
        ;;
    *)
        echo "Usage: $0 {deploy|increase|promote|rollback|verify|monitor}"
        echo "  deploy   - Deploy canary version"
        echo "  increase - Increase canary traffic (percentage)"
        echo "  promote  - Promote canary to stable"
        echo "  rollback - Rollback canary deployment"
        echo "  verify   - Verify canary health"
        echo "  monitor  - Monitor canary metrics"
        exit 1
        ;;
esac
