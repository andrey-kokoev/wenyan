package controller

type WenyanConsortSpec struct {
	Replicas int
}

type ReconcileResult struct {
	Requeue bool
}

func Reconcile(spec WenyanConsortSpec) ReconcileResult {
	if spec.Replicas <= 0 {
		return ReconcileResult{Requeue: true}
	}
	return ReconcileResult{Requeue: false}
}
