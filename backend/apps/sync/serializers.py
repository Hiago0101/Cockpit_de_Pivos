from rest_framework import serializers

class SingleSyncOperationSerializer(serializers.Serializer):
    client_op_id = serializers.UUIDField()
    entity = serializers.ChoiceField(choices=["pivo", "registro_irrigacao", "alerta", "plano"])
    action = serializers.ChoiceField(choices=["CREATE", "UPDATE", "UPDATE_STATUS", "ACKNOWLEDGE"])
    occurred_at = serializers.DateTimeField()
    payload = serializers.DictField()

class SyncPushBatchSerializer(serializers.Serializer):
    client_device_id = serializers.CharField(max_length=100, required=False, default="MOBILE_UNKNOWN")
    batch_timestamp = serializers.DateTimeField(required=False)
    operations = SingleSyncOperationSerializer(many=True)
