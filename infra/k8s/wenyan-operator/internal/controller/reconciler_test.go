package controller

import "testing"

func TestReconcile(t *testing.T) {
	if !Reconcile(WenyanConsortSpec{Replicas: 0}).Requeue {
		t.Fatalf("expected requeue for invalid replicas")
	}
	if Reconcile(WenyanConsortSpec{Replicas: 3}).Requeue {
		t.Fatalf("expected stable reconcile for valid replicas")
	}
}
