#!/bin/bash

# Blue/Green Deployment Switch Script
# This script switches traffic between blue and green deployments

set -e

NAMESPACE="calqulusrms"
BLUE_DEPLOYMENT="calqulusrms-blue"
GREEN_DEPLOYMENT="calqulusrms-green"
ACTIVE_SERVICE="calqulusrms-active"

# Function to switch to blue deployment
switch_to_blue() {
    echo "Switching to blue deployment..."
    
    # Update the active service to point to blue
    kubectl patch service $ACTIVE_SERVICE -n $NAMESPACE -p '{"spec":{"selector":{"version":"blue"}}}'
    
    # Scale up blue deployment
    kubectl scale deployment $BLUE_DEPLOYMENT -n $NAMESPACE --replicas=3
    
    # Scale down green deployment
    kubectl scale deployment $GREEN_DEPLOYMENT -n $NAMESPACE --replicas=0
    
    echo "Switched to blue deployment successfully"
}

# Function to switch to green deployment
switch_to_green() {
    echo "Switching to green deployment..."
    
    # Update the active service to point to green
    kubectl patch service $ACTIVE_SERVICE -n $NAMESPACE -p '{"spec":{"selector":{"version":"green"}}}'
    
    # Scale up green deployment
    kubectl scale deployment $GREEN_DEPLOYMENT -n $NAMESPACE --replicas=3
    
    # Scale down blue deployment
    kubectl scale deployment $BLUE_DEPLOYMENT -n $NAMESPACE --replicas=0
    
    echo "Switched to green deployment successfully"
}

# Function to check current active deployment
check_active() {
    ACTIVE_SELECTOR=$(kubectl get service $ACTIVE_SERVICE -n $NAMESPACE -o jsonpath='{.spec.selector.version}')
    echo "Current active deployment: $ACTIVE_SELECTOR"
}

# Function to verify deployment health
verify_deployment() {
    DEPLOYMENT=$1
    echo "Verifying deployment $DEPLOYMENT..."
    
    kubectl rollout status deployment $DEPLOYMENT -n $NAMESPACE --timeout=5m
    
    # Check if pods are ready
    READY_PODS=$(kubectl get deployment $DEPLOYMENT -n $NAMESPACE -o jsonpath='{.status.readyReplicas}')
    DESIRED_PODS=$(kubectl get deployment $DEPLOYMENT -n $NAMESPACE -o jsonpath='{.spec.replicas}')
    
    if [ "$READY_PODS" -eq "$DESIRED_PODS" ]; then
        echo "Deployment $DEPLOYMENT is healthy"
        return 0
    else
        echo "Deployment $DEPLOYMENT is not healthy: $READY_PODS/$DESIRED_PODS pods ready"
        return 1
    fi
}

# Main script logic
case "$1" in
    blue)
        check_active
        verify_deployment $BLUE_DEPLOYMENT
        switch_to_blue
        verify_deployment $BLUE_DEPLOYMENT
        ;;
    green)
        check_active
        verify_deployment $GREEN_DEPLOYMENT
        switch_to_green
        verify_deployment $GREEN_DEPLOYMENT
        ;;
    check)
        check_active
        ;;
    *)
        echo "Usage: $0 {blue|green|check}"
        echo "  blue  - Switch to blue deployment"
        echo "  green - Switch to green deployment"
        echo "  check - Check current active deployment"
        exit 1
        ;;
esac
