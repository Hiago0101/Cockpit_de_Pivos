import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";
import { MobilePivot } from "../types";
import { localDb } from "../database/sqlite";

interface IrrigationFormScreenProps {
  pivot?: MobilePivot;
  onBack: () => void;
  onSuccess: () => void;
}

export function IrrigationFormScreen({ pivot, onBack, onSuccess }: IrrigationFormScreenProps) {
  const [percentimetro, setPercentimetro] = useState("85");
  const [lamina, setLamina] = useState("7.2");
  const [sentido, setSentido] = useState<"HORARIO" | "ANTI_HORARIO">("HORARIO");
  const [hidrometro, setHidrometro] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const handleSubmit = async () => {
    if (!pivot) {
      Alert.alert("Erro", "Pivô não selecionado.");
      return;
    }

    const payload = {
      pivo_id: pivot.id,
      percentimetro: parseInt(percentimetro, 10) || 100,
      lamina_aplicada_mm: parseFloat(lamina) || 0.0,
      sentido,
      hidrometro_inicial_m3: hidrometro ? parseFloat(hidrometro) : null,
      observacoes: observacoes.trim(),
      inicio_em: new Date().toISOString(),
    };

    // Salva na fila de sincronização offline
    await localDb.enqueueOperation("registro_irrigacao", "CREATE", payload);

    Alert.alert(
      "Apontamento Registrado",
      "O registro de irrigação foi salvo localmente e adicionado à fila de sincronização.",
      [{ text: "OK", onPress: onSuccess }]
    );
  };

  return (
    <View style={styles.container}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Cancelar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Novo Apontamento</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pivô Selecionado</Text>
          <Text style={styles.pivotInfo}>{pivot ? `${pivot.codigo} — ${pivot.nome}` : "Nenhum pivô selecionado"}</Text>
          <Text style={styles.farmInfo}>{pivot?.fazenda_nome || "Fazenda Principal"}</Text>

          <View style={styles.divider} />

          {/* Percentímetro */}
          <Text style={styles.label}>Percentímetro de Operação (%)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={percentimetro}
            onChangeText={setPercentimetro}
            placeholder="Ex: 85"
          />

          {/* Lâmina */}
          <Text style={styles.label}>Lâmina d'Água Estimada (mm)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={lamina}
            onChangeText={setLamina}
            placeholder="Ex: 7.2"
          />

          {/* Sentido */}
          <Text style={styles.label}>Sentido de Rotação</Text>
          <View style={styles.directionRow}>
            <TouchableOpacity
              style={[styles.directionBtn, sentido === "HORARIO" && styles.directionBtnActive]}
              onPress={() => setSentido("HORARIO")}
            >
              <Text style={[styles.directionText, sentido === "HORARIO" && styles.directionTextActive]}>
                Sentido Horário
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.directionBtn, sentido === "ANTI_HORARIO" && styles.directionBtnActive]}
              onPress={() => setSentido("ANTI_HORARIO")}
            >
              <Text style={[styles.directionText, sentido === "ANTI_HORARIO" && styles.directionTextActive]}>
                Anti-Horário
              </Text>
            </TouchableOpacity>
          </View>

          {/* Hidrômetro */}
          <Text style={styles.label}>Leitura do Hidrômetro (m³ opcional)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={hidrometro}
            onChangeText={setHidrometro}
            placeholder="Ex: 145230.5"
          />

          {/* Observações */}
          <Text style={styles.label}>Observações de Campo</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            multiline
            numberOfLines={3}
            value={observacoes}
            onChangeText={setObservacoes}
            placeholder="Anotações sobre pressão, emissores ou condições de solo..."
          />

          <TouchableOpacity style={styles.saveBtn} onPress={handleSubmit}>
            <Text style={styles.saveBtnText}>Salvar Apontamento (Offline OK)</Text>
          </TouchableOpacity>
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
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 18,
    borderColor: "#e2e8f0",
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1b7d52",
    textTransform: "uppercase",
  },
  pivotInfo: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginTop: 4,
  },
  farmInfo: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginVertical: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: "#f8fafc",
    borderColor: "#cbd5e1",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  directionRow: {
    flexDirection: "row",
    gap: 10,
  },
  directionBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: "#e2e8f0",
    borderRadius: 8,
    alignItems: "center",
  },
  directionBtnActive: {
    backgroundColor: "#1b7d52",
  },
  directionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  directionTextActive: {
    color: "#ffffff",
  },
  saveBtn: {
    backgroundColor: "#1b7d52",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
  },
  saveBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
});
