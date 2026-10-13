import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import {
  Building2,
  Plus,
  Search,
  Edit2,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  X,
} from "lucide-react-native";
import { mobileApi } from "../services/api";
import { MobileFarm, MobileField } from "../types";

interface FarmsScreenProps {
  onNavigateToFields?: (farmId?: string) => void;
}

export function FarmsScreen({ onNavigateToFields }: FarmsScreenProps) {
  const [farms, setFarms] = useState<MobileFarm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal de Criação / Edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFarm, setEditingFarm] = useState<MobileFarm | null>(null);
  const [formNome, setFormNome] = useState("");
  const [formFilial, setFormFilial] = useState("");
  const [formIdPims, setFormIdPims] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal de Confirmação de Exclusão
  const [farmToDelete, setFarmToDelete] = useState<MobileFarm | null>(null);
  const [linkedFields, setLinkedFields] = useState<MobileField[]>([]);
  const [isCheckingDelete, setIsCheckingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadFarms = async () => {
    setIsLoading(true);
    try {
      const data = await mobileApi.getFarms();
      setFarms(data);
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível carregar as fazendas.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFarms();
  }, []);

  const handleOpenCreate = () => {
    setEditingFarm(null);
    setFormNome("");
    setFormFilial("");
    setFormIdPims("");
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (farm: MobileFarm) => {
    setEditingFarm(farm);
    setFormNome((farm.nome || "").toUpperCase());
    setFormFilial(farm.filial || farm.codigo || "");
    setFormIdPims(farm.id_pims || "");
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSaveFarm = async () => {
    setModalError(null);

    const cleanNome = formNome.trim().toUpperCase();
    const cleanFilial = formFilial.trim();
    const cleanIdPims = formIdPims.trim();

    // 1. Validação de Nome
    if (!cleanNome) {
      setModalError("O nome da fazenda é obrigatório.");
      return;
    }
    if (cleanNome.length < 3) {
      setModalError("O nome da fazenda deve ter pelo menos 3 caracteres.");
      return;
    }

    // 2. Validação de Filial (6 dígitos numéricos)
    if (!cleanFilial) {
      setModalError("O número da filial é obrigatório.");
      return;
    }
    if (cleanFilial.length !== 6 || !/^\d{6}$/.test(cleanFilial)) {
      setModalError("A filial deve conter exatamente 6 dígitos numéricos (apenas números).");
      return;
    }

    // 3. Validação de duplicidade de Filial
    const filialDuplicada = farms.find(
      (f) =>
        (f.filial?.trim() === cleanFilial || f.codigo?.trim() === cleanFilial) &&
        (!editingFarm || f.id !== editingFarm.id)
    );
    if (filialDuplicada) {
      setModalError(`A filial "${cleanFilial}" já está em uso na fazenda "${filialDuplicada.nome}".`);
      return;
    }

    // 4. Validação de duplicidade de ID PIMS
    if (cleanIdPims) {
      const pimsDuplicado = farms.find(
        (f) =>
          f.id_pims?.trim().toLowerCase() === cleanIdPims.toLowerCase() &&
          (!editingFarm || f.id !== editingFarm.id)
      );
      if (pimsDuplicado) {
        setModalError(`O ID PIMS "${cleanIdPims}" já está cadastrado na fazenda "${pimsDuplicado.nome}".`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const payload: Partial<MobileFarm> = {
        nome: cleanNome,
        filial: cleanFilial,
        codigo: cleanFilial,
        id_pims: cleanIdPims,
      };

      if (editingFarm) {
        await mobileApi.updateFarm(editingFarm.id, payload);
        Alert.alert("Sucesso", `Fazenda "${cleanNome}" atualizada com sucesso!`);
      } else {
        await mobileApi.createFarm(payload);
        Alert.alert("Sucesso", `Fazenda "${cleanNome}" cadastrada com sucesso!`);
      }

      setIsModalOpen(false);
      await loadFarms();
    } catch (err: any) {
      setModalError(err?.message || "Erro ao salvar fazenda no servidor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDelete = async (farm: MobileFarm) => {
    setFarmToDelete(farm);
    setIsCheckingDelete(true);
    setLinkedFields([]);
    try {
      const fields = await mobileApi.getFields({ fazenda: farm.id });
      setLinkedFields(fields);
    } catch {
      // Ignora falha de checagem prévia; backend validará
    } finally {
      setIsCheckingDelete(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!farmToDelete) return;
    const target = farmToDelete;
    setIsDeleting(true);

    try {
      await mobileApi.deleteFarm(target.id);
      setFarmToDelete(null);
      Alert.alert("Sucesso", `Fazenda "${target.nome}" excluída com sucesso!`);
      await loadFarms();
    } catch (err: any) {
      Alert.alert("Não é possível excluir", err?.message || "Erro ao excluir fazenda.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyId = (id: string) => {
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const filteredFarms = farms.filter((f) => {
    const term = searchTerm.toLowerCase();
    const matchesNome = f.nome?.toLowerCase().includes(term);
    const matchesFilial = (f.filial || f.codigo || "").toLowerCase().includes(term);
    const matchesId = f.id?.toLowerCase().includes(term);
    const matchesPims = f.id_pims?.toLowerCase().includes(term);
    return matchesNome || matchesFilial || matchesId || matchesPims;
  });

  return (
    <View style={styles.container}>
      {/* Header da Tela */}
      <View style={styles.screenHeader}>
        <View style={styles.screenHeaderTitleGroup}>
          <View style={styles.iconBadge}>
            <Building2 size={20} color="#10b981" />
          </View>
          <View>
            <Text style={styles.screenTitle}>Cadastro de Fazendas</Text>
            <Text style={styles.screenSubtitle}>Unidades agrícolas e filiais</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={loadFarms}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            <RefreshCw size={16} color="#64748b" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.createButton}
            onPress={handleOpenCreate}
            activeOpacity={0.8}
          >
            <Plus size={16} color="#ffffff" />
            <Text style={styles.createButtonText}>Nova</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Barra de Busca e Filtros */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBox}>
          <Search size={18} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nome, filial ou ID..."
            placeholderTextColor="#94a3b8"
            value={searchTerm}
            onChangeText={setSearchTerm}
            autoCapitalize="none"
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm("")}>
              <X size={16} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.counterText}>
          {filteredFarms.length} fazenda(s) encontrada(s)
        </Text>
      </View>

      {/* Lista de Fazendas */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>Carregando fazendas...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredFarms}
          keyExtractor={(item, index) => String(item?.id || index)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const filialDisplay = item.filial || item.codigo || "—";
            return (
              <View style={styles.farmCard}>
                {/* Linha Superior: Nome e Filial */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.farmNameGroup}>
                    <Text style={styles.farmName} numberOfLines={1}>
                      {item.nome}
                    </Text>
                    {item.id_pims && (
                      <View style={styles.pimsBadge}>
                        <Text style={styles.pimsBadgeText}>PIMS: {item.id_pims}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.filialBadge}>
                    <Text style={styles.filialBadgeText}>Filial: {filialDisplay}</Text>
                  </View>
                </View>

                {/* Linha do ID com Cópia */}
                <View style={styles.idRow}>
                  <Text style={styles.idLabel}>ID:</Text>
                  <Text style={styles.idValue} numberOfLines={1}>
                    {item.id}
                  </Text>
                  <TouchableOpacity
                    style={styles.copyButton}
                    onPress={() => handleCopyId(item.id)}
                    activeOpacity={0.7}
                  >
                    {copiedId === item.id ? (
                      <Check size={14} color="#10b981" />
                    ) : (
                      <Copy size={14} color="#64748b" />
                    )}
                    <Text style={styles.copyButtonText}>
                      {copiedId === item.id ? "Copiado!" : "Copiar"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Linha de Ações: Editar e Excluir */}
                <View style={styles.cardActionsRow}>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => handleOpenEdit(item)}
                    activeOpacity={0.7}
                  >
                    <Edit2 size={14} color="#0f766e" />
                    <Text style={styles.editButtonText}>Editar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleOpenDelete(item)}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={14} color="#dc2626" />
                    <Text style={styles.deleteButtonText}>Excluir</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Building2 size={42} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>Nenhuma fazenda encontrada</Text>
              <Text style={styles.emptySubtitle}>
                {searchTerm
                  ? "Tente refinar sua busca por filial ou nome."
                  : "Toque em '+ Nova' para cadastrar a primeira fazenda."}
              </Text>
            </View>
          }
        />
      )}

      {/* MODAL: Criar / Editar Fazenda */}
      <Modal
        visible={isModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingFarm ? "Editar Fazenda" : "Nova Fazenda"}
              </Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {modalError && (
              <View style={styles.errorBanner}>
                <AlertCircle size={16} color="#ef4444" />
                <Text style={styles.errorBannerText}>{modalError}</Text>
              </View>
            )}

            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              {/* Campo Nome da Fazenda */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nome da Fazenda *</Text>
                <TextInput
                  style={[styles.input, styles.inputUppercase]}
                  placeholder="Ex: FAZENDA FARROUPILHA I"
                  placeholderTextColor="#94a3b8"
                  value={formNome}
                  onChangeText={(text) => setFormNome(text.toUpperCase())}
                  autoCapitalize="characters"
                />
                <Text style={styles.inputHelp}>Convertido automaticamente para maiúsculo.</Text>
              </View>

              {/* Campo Filial */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Filial *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="000001"
                  placeholderTextColor="#94a3b8"
                  value={formFilial}
                  onChangeText={(text) => setFormFilial(text.replace(/\D/g, "").slice(0, 6))}
                  keyboardType="numeric"
                  maxLength={6}
                />
                <Text style={styles.inputHelp}>
                  Exatamente 6 dígitos numéricos ({formFilial.length}/6).
                </Text>
              </View>

              {/* Campo ID PIMS */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>ID PIMS (Opcional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: PIMS-001"
                  placeholderTextColor="#94a3b8"
                  value={formIdPims}
                  onChangeText={setFormIdPims}
                  maxLength={50}
                />
                <Text style={styles.inputHelp}>
                  Identificador para integrações externas.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setIsModalOpen(false)}
                disabled={isSubmitting}
              >
                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitButton}
                onPress={handleSaveFarm}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalSubmitButtonText}>
                    {editingFarm ? "Salvar" : "Cadastrar"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: Confirmação de Exclusão */}
      <Modal
        visible={Boolean(farmToDelete)}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setFarmToDelete(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalCard}>
            <View style={styles.deleteModalHeader}>
              <View style={styles.deleteIconBadge}>
                <Trash2 size={24} color="#dc2626" />
              </View>
              <Text style={styles.deleteModalTitle}>Confirmar Exclusão</Text>
            </View>

            <Text style={styles.deleteModalMessage}>
              Tem certeza que deseja excluir a fazenda{" "}
              <Text style={{ fontWeight: "700" }}>"{farmToDelete?.nome}"</Text>{" "}
              (Filial: {farmToDelete?.filial || farmToDelete?.codigo})?
            </Text>

            {isCheckingDelete ? (
              <View style={styles.checkingContainer}>
                <ActivityIndicator size="small" color="#0f766e" />
                <Text style={styles.checkingText}>Verificando talhões vinculados...</Text>
              </View>
            ) : linkedFields.length > 0 ? (
              <View style={styles.blockedAlert}>
                <AlertCircle size={18} color="#b91c1c" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.blockedAlertTitle}>
                    Exclusão Bloqueada: {linkedFields.length} talhão(ões)
                  </Text>
                  <Text style={styles.blockedAlertText}>
                    Esta fazenda possui talhões cadastrados ({linkedFields.map((f) => f.codigo).slice(0, 3).join(", ")}
                    {linkedFields.length > 3 ? "..." : ""}). Exclua primeiro os talhões antes de excluir a fazenda.
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.deleteModalWarning}>
                Esta ação é irreversível e removerá o cadastro definitivamente.
              </Text>
            )}

            <View style={styles.deleteModalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setFarmToDelete(null)}
                disabled={isDeleting}
              >
                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmDeleteButton,
                  (linkedFields.length > 0 || isCheckingDelete) && styles.disabledDeleteButton,
                ]}
                onPress={handleConfirmDelete}
                disabled={isDeleting || isCheckingDelete || linkedFields.length > 0}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.confirmDeleteButtonText}>
                    {linkedFields.length > 0 ? "Bloqueado" : "Sim, Excluir"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  screenHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  screenHeaderTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  screenTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  screenSubtitle: {
    fontSize: 11,
    color: "#64748b",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  refreshButton: {
    width: 34,
    height: 34,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#10b981",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  createButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0f172a",
    paddingVertical: 0,
  },
  counterText: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 6,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  farmCard: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  farmNameGroup: {
    flex: 1,
    marginRight: 8,
  },
  farmName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  pimsBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  pimsBadgeText: {
    fontSize: 10,
    color: "#475569",
    fontWeight: "600",
  },
  filialBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.25)",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  filialBadgeText: {
    color: "#059669",
    fontSize: 11,
    fontWeight: "800",
    fontFamily: "monospace",
  },
  idRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 10,
    gap: 6,
  },
  idLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94a3b8",
  },
  idValue: {
    flex: 1,
    fontSize: 11,
    color: "#64748b",
    fontFamily: "monospace",
  },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  copyButtonText: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "600",
  },
  cardActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 10,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "rgba(15, 118, 110, 0.08)",
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0f766e",
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "rgba(220, 38, 38, 0.08)",
  },
  deleteButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#dc2626",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: "#64748b",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#94a3b8",
    textAlign: "center",
    maxWidth: 240,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    width: "100%",
    maxHeight: "85%",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fee2e2",
    marginHorizontal: 18,
    marginTop: 12,
    padding: 10,
    borderRadius: 6,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 11,
    color: "#b91c1c",
  },
  modalBody: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 6,
  },
  input: {
    height: 42,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    backgroundColor: "#ffffff",
    color: "#0f172a",
  },
  inputUppercase: {
    fontWeight: "600",
  },
  inputHelp: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 4,
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  modalCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  modalCancelButtonText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "600",
  },
  modalSubmitButton: {
    backgroundColor: "#10b981",
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 6,
    minWidth: 90,
    alignItems: "center",
  },
  modalSubmitButtonText: {
    fontSize: 13,
    color: "#ffffff",
    fontWeight: "700",
  },
  deleteModalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 20,
    width: "100%",
  },
  deleteModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  deleteIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fee2e2",
    justifyContent: "center",
    alignItems: "center",
  },
  deleteModalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#dc2626",
  },
  deleteModalMessage: {
    fontSize: 13,
    color: "#334155",
    lineHeight: 18,
    marginBottom: 10,
  },
  deleteModalWarning: {
    fontSize: 11,
    color: "#94a3b8",
    marginBottom: 16,
  },
  checkingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginVertical: 12,
  },
  checkingText: {
    fontSize: 12,
    color: "#64748b",
  },
  blockedAlert: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginVertical: 10,
  },
  blockedAlertTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#991b1b",
  },
  blockedAlertText: {
    fontSize: 11,
    color: "#b91c1c",
    marginTop: 2,
    lineHeight: 15,
  },
  deleteModalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 8,
  },
  confirmDeleteButton: {
    backgroundColor: "#dc2626",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 6,
    minWidth: 100,
    alignItems: "center",
  },
  confirmDeleteButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  disabledDeleteButton: {
    backgroundColor: "#94a3b8",
  },
});
