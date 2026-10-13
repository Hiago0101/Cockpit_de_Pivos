import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { MobilePivot, PivotStatus, PivotDirection } from "../types";
import { localDb } from "../database/sqlite";
import { mobileApi } from "../services/api";

interface PivotDetailScreenProps {
  pivot: MobilePivot;
  onBack: () => void;
  onOpenIrrigationForm: (pivot: MobilePivot) => void;
}

export function PivotDetailScreen({ pivot, onBack, onOpenIrrigationForm }: PivotDetailScreenProps) {
  const [currentPivot, setCurrentPivot] = useState<MobilePivot>(pivot);
  const [loadingAction, setLoadingAction] = useState(false);

  const handleQuickCommand = async (
    newStatus: PivotStatus,
    newPercent: number,
    newDirection: PivotDirection
  ) => {
    setLoadingAction(true);
    const payload = {
      status_operacional: newStatus,
      percentimetro_atual: newPercent,
      sentido_rotacao: newDirection,
    };

    try {
      // 1. Tenta envio online
      await mobileApi.quickCommand(currentPivot.id, payload);
      const updated = await localDb.updateLocalPivot(currentPivot.id, payload);
      if (updated) setCurrentPivot(updated);
      Alert.alert("Sucesso", "Comando enviado e confirmado pelo servidor central!");
    } catch {
      // 2. Se falhar / offline: grava na base local e enfileira na sync_queue
      await localDb.enqueueOperation("pivo", "UPDATE", {
        id: currentPivot.id,
        ...payload,
      });
      const updated = await localDb.updateLocalPivot(currentPivot.id, payload);
      if (updated) setCurrentPivot(updated);
      Alert.alert(
        "Modo Offline",
        "Sem conexão com o servidor. Comando registrado localmente e salvo na fila de sincronização!"
      );
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{currentPivot.codigo}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Cartão de Estado Principal */}
        <View style={styles.statusCard}>
          <Text style={styles.pivotTitle}>{currentPivot.nome}</Text>
          <Text style={styles.farmTitle}>{currentPivot.fazenda_nome || "Fazenda Principal"}</Text>

          <View style={styles.stateRow}>
            <View>
              <Text style={styles.stateLabel}>Status Operacional</Text>
              <Text style={styles.stateValue}>{currentPivot.status_display || currentPivot.status_operacional}</Text>
            </View>
            <View>
              <Text style={styles.stateLabel}>Percentímetro</Text>
              <Text style={styles.stateValue}>{currentPivot.percentimetro_atual}%</Text>
            </View>
            <View>
              <Text style={styles.stateLabel}>Ângulo Atual</Text>
              <Text style={styles.stateValue}>{currentPivot.angulo_atual_graus}°</Text>
            </View>
          </View>
        </View>

        {/* Painel de Controle Rápido de Campo */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Comandos de Campo (Modo Simulação)</Text>
          <Text style={styles.sectionSubtitle}>
            Atualiza o estado registrado no sistema (sem telemetria direta com painel elétrico de campo). Ações gravadas offline em caso de falta de sinal.
          </Text>

          {loadingAction ? (
            <ActivityIndicator size="small" color="#1b7d52" style={{ marginVertical: 12 }} />
          ) : (
            <View style={styles.buttonGrid}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.btnStart]}
                onPress={() => handleQuickCommand("IRRIGANDO", 80, "HORARIO")}
              >
                <Text style={styles.btnText}>Ligar Pivô (80% Horário)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.btnStop]}
                onPress={() => handleQuickCommand("PARADO", currentPivot.percentimetro_atual, "ESTACIONARIO")}
              >
                <Text style={styles.btnText}>Desligar / Parar Pivô</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.btnReverse]}
                onPress={() =>
                  handleQuickCommand(
                    currentPivot.status_operacional,
                    currentPivot.percentimetro_atual,
                    currentPivot.sentido_rotacao === "HORARIO" ? "ANTI_HORARIO" : "HORARIO"
                  )
                }
              >
                <Text style={styles.btnText}>Inverter Sentido de Giro</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={styles.irrigationRecordBtn}
            onPress={() => onOpenIrrigationForm(currentPivot)}
          >
            <Text style={styles.irrigationRecordBtnText}>+ Apontar Registro de Irrigação</Text>
          </TouchableOpacity>
        </View>

        {/* Ficha Técnica de Engenharia */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Parâmetros de Engenharia</Text>
          <View style={styles.specsTable}>
            <View style={styles.specRow}>
              <Text style={styles.specKey}>Fabricante / Modelo:</Text>
              <Text style={styles.specVal}>{currentPivot.fabricante} ({currentPivot.modelo})</Text>
            </View>
            <View style={styles.specRow}>
              <Text style={styles.specKey}>Raio Total:</Text>
              <Text style={styles.specVal}>{currentPivot.raio_metros} metros</Text>
            </View>
            <View style={styles.specRow}>
              <Text style={styles.specKey}>Área Irrigada:</Text>
              <Text style={styles.specVal}>{currentPivot.area_irrigada_ha} hectares</Text>
            </View>
            <View style={styles.specRow}>
              <Text style={styles.specKey}>Vazão Nominal:</Text>
              <Text style={styles.specVal}>{currentPivot.vazao_nominal_m3h} m³/h</Text>
            </View>
            <View style={styles.specRow}>
              <Text style={styles.specKey}>Pressão de Projeto:</Text>
              <Text style={styles.specVal}>{currentPivot.pressao_nominal_bar} bar</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f6f8",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#132a22",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backButton: {
    paddingVertical: 4,
  },
  backButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  content: {
    padding: 16,
    gap: 16,
  },
  statusCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    borderColor: "#e2e8f0",
    borderWidth: 1,
  },
  pivotTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
  },
  farmTitle: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
    marginBottom: 16,
  },
  stateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 8,
  },
  stateLabel: {
    fontSize: 11,
    color: "#64748b",
  },
  stateValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    borderColor: "#e2e8f0",
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 4,
    marginBottom: 14,
  },
  buttonGrid: {
    gap: 10,
  },
  actionBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  btnStart: {
    backgroundColor: "#1b7d52",
  },
  btnStop: {
    backgroundColor: "#e11d48",
  },
  btnReverse: {
    backgroundColor: "#0284c7",
  },
  btnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  irrigationRecordBtn: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#1b7d52",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  irrigationRecordBtnText: {
    color: "#1b7d52",
    fontSize: 14,
    fontWeight: "700",
  },
  specsTable: {
    gap: 8,
    marginTop: 8,
  },
  specRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  specKey: {
    fontSize: 13,
    color: "#64748b",
  },
  specVal: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e293b",
  },
});
