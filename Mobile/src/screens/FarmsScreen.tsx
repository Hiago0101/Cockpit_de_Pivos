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
  RefreshControl,
  useWindowDimensions,
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
  ChevronRight,
} from "lucide-react-native";
import { mobileApi } from "../services/api";
import { MobileFarm, MobileField } from "../types";

interface FarmsScreenProps {
  onNavigateToFields?: (farmId?: string) => void;
}

export function FarmsScreen({ onNavigateToFields }: FarmsScreenProps) {
  const { width: screenWidth } = useWindowDimensions();
  const isDesktop = screenWidth >= 768;

  const [farms, setFarms] = useState<MobileFarm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
    try {
      const data = await mobileApi.getFarms();
      setFarms(data);
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível carregar as fazendas.");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadFarms();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadFarms();
  };

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
    setTimeout(() => setCopiedId(null), 2000);
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
      {/* 1. Header Padronizado */}
      <View style={styles.screenHeader}>
        <View style={styles.screenTitleRow}>
          <View style={styles.screenTitleGroup}>
            <View style={styles.screenIconBox}>
              <Building2 size={20} color="#10b981" />
            </View>
            <View>
              <Text style={styles.screenTitle}>Gestão de Fazendas</Text>
              <Text style={styles.screenSubtitle}>
                {farms.length} unidade(s) agrícola(s) cadastrada(s)
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={handleRefresh}
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

        {/* 2. Barra de Busca Padronizada */}
        <View style={styles.searchBarContainer}>
          <View style={styles.searchBox}>
            <Search size={18} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por nome, filial ou ID PIMS..."
              placeholderTextColor="#94a3b8"
              value={searchTerm}
              onChangeText={setSearchTerm}
              autoCapitalize="none"
            />
            {searchTerm.length > 0 && (
              <TouchableOpacity onPress={() => setSearchTerm("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={16} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* 3. Lista e Cards Padronizados */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1b7d52" />
          <Text style={styles.loadingText}>Carregando fazendas...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredFarms}
          keyExtractor={(item, index) => String(item?.id || index)}
          contentContainerStyle={[styles.listContent, isDesktop && styles.listContentDesktop]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={["#10b981"]}
            />
          }
          renderItem={({ item }) => {
            const filialDisplay = item.filial || item.codigo || "—";
            return (
              <View style={[styles.recordCard, isDesktop && styles.recordCardDesktop]}>
                {/* Linha Superior: Ícone + Título + Ações */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardTitleGroup}>
                    <View style={styles.cardIconBox}>
                      <Building2 size={18} color="#10b981" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {item.nome}
                      </Text>
                      <Text style={styles.cardSubtitle}>
                        Filial {filialDisplay}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardActionButtons}>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleOpenEdit(item)}
                      activeOpacity={0.7}
                    >
                      <Edit2 size={15} color="#0f766e" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionBtnDelete}
                      onPress={() => handleOpenDelete(item)}
                      activeOpacity={0.7}
                    >
                      <Trash2 size={15} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Grade de Métricas Padronizada (3 colunas) */}
                <View style={styles.metricsGrid}>
                  <View style={styles.metricCol}>
                    <Text style={styles.metricLabel}>FILIAL</Text>
                    <Text style={styles.metricValue}>{filialDisplay}</Text>
                  </View>
                  <View style={styles.metricCol}>
                    <Text style={styles.metricLabel}>ID PIMS</Text>
                    <Text style={styles.metricValue} numberOfLines={1}>
                      {item.id_pims || "—"}
                    </Text>
                  </View>
                  <View style={styles.metricCol}>
                    <Text style={styles.metricLabel}>STATUS</Text>
                    <View style={styles.statusPill}>
                      <Text style={styles.statusPillText}>Ativa</Text>
                    </View>
                  </View>
                </View>

                {/* Rodapé: ID do Sistema + Atalho para Talhões */}
                <View style={styles.cardFooter}>
                  <View style={styles.idGroup}>
                    <Text style={styles.idLabel}>ID:</Text>
                    <Text style={styles.idValue} numberOfLines={1}>
                      {item.id.slice(0, 10)}...
                    </Text>
                    <TouchableOpacity
                      style={styles.copyBtn}
                      onPress={() => handleCopyId(item.id)}
                      activeOpacity={0.7}
                    >
                      {copiedId === item.id ? (
                        <Check size={12} color="#10b981" />
                      ) : (
                        <Copy size={12} color="#64748b" />
                      )}
                      <Text style={styles.copyBtnText}>
                        {copiedId === item.id ? "Copiado!" : "Copiar"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {onNavigateToFields && (
                    <TouchableOpacity
                      style={styles.linkTalhoes}
                      onPress={() => onNavigateToFields(item.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.linkTalhoesText}>Ver Talhões</Text>
                      <ChevronRight size={14} color="#1b7d52" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBox}>
                <Building2 size={36} color="#94a3b8" />
              </View>
              <Text style={styles.emptyTitle}>Nenhuma fazenda encontrada</Text>
              <Text style={styles.emptySubtitle}>
                {searchTerm.length > 0
                  ? "Tente refinar sua busca por nome ou filial."
                  : "Toque em '+ Nova' para cadastrar a primeira unidade agrícola."}
              </Text>
              {searchTerm.length === 0 && (
                <TouchableOpacity
                  style={styles.emptyCreateButton}
                  onPress={handleOpenCreate}
                  activeOpacity={0.8}
                >
                  <Plus size={16} color="#ffffff" />
                  <Text style={styles.emptyCreateButtonText}>Cadastrar Primeira Fazenda</Text>
                </TouchableOpacity>
              )}
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
          <View style={[styles.modalCard, isDesktop && styles.modalCardDesktop]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={styles.modalHeaderIcon}>
                  <Building2 size={18} color="#10b981" />
                </View>
                <Text style={styles.modalTitle}>
                  {editingFarm ? "Editar Fazenda" : "Nova Fazenda"}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsModalOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
                  placeholder="Ex: FAZENDA SANTA MARIA"
                  placeholderTextColor="#94a3b8"
                  value={formNome}
                  onChangeText={(text) => setFormNome(text.toUpperCase())}
                  autoCapitalize="characters"
                />
                <Text style={styles.inputHelp}>Convertido automaticamente para maiúsculo.</Text>
              </View>

              {/* Campo Filial */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Filial (6 dígitos numéricos) *</Text>
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
                    {editingFarm ? "Salvar Alterações" : "Cadastrar Fazenda"}
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
          <View style={[styles.deleteModalCard, isDesktop && styles.modalCardDesktop]}>
            <View style={styles.deleteModalHeader}>
              <View style={styles.deleteIconBadge}>
                <Trash2 size={24} color="#dc2626" />
              </View>
              <Text style={styles.deleteModalTitle}>Confirmar Exclusão</Text>
            </View>

            <Text style={styles.deleteModalMessage}>
              Tem certeza que deseja excluir a fazenda{" "}
              <Text style={{ fontWeight: "700", color: "#0f172a" }}>"{farmToDelete?.nome}"</Text>{" "}
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
                  styles.deleteModalConfirmButton,
                  linkedFields.length > 0 && styles.disabledButton,
                ]}
                onPress={handleConfirmDelete}
                disabled={isDeleting || linkedFields.length > 0}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.deleteModalConfirmText}>Confirmar Exclusão</Text>
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
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  screenTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  screenTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  screenIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    alignItems: "center",
    justifyContent: "center",
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  screenSubtitle: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
    fontWeight: "500",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1b7d52",
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  createButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0f172a",
    paddingVertical: 0,
  },

  // Conteúdo da Lista e Cards
  listContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  listContentDesktop: {
    alignItems: "center",
  },
  recordCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  recordCardDesktop: {
    maxWidth: 960,
    width: "100%",
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  cardTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  cardIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  cardSubtitle: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 1,
    fontWeight: "500",
  },
  cardActionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnDelete: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    alignItems: "center",
    justifyContent: "center",
  },

  // Grade de Métricas (3 Colunas)
  metricsGrid: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    padding: 10,
    marginBottom: 12,
  },
  metricCol: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
  },
  statusPill: {
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    alignSelf: "flex-start",
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#047857",
  },

  // Rodapé do Card
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 10,
  },
  idGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  idLabel: {
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: "600",
  },
  idValue: {
    fontSize: 11,
    fontFamily: "monospace",
    color: "#64748b",
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "#f1f5f9",
  },
  copyBtnText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748b",
  },
  linkTalhoes: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#ecfdf5",
  },
  linkTalhoesText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1b7d52",
  },

  // Estados Centrais e Vazios
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 18,
  },
  emptyCreateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1b7d52",
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 8,
    marginTop: 16,
  },
  emptyCreateButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },

  // Modais Padronizados
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    width: "100%",
    maxWidth: 480,
    maxHeight: "90%",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalCardDesktop: {
    maxWidth: 520,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  modalBody: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0f172a",
  },
  inputUppercase: {
    textTransform: "uppercase",
  },
  inputHelp: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 4,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    marginHorizontal: 20,
    marginTop: 14,
    padding: 10,
    borderRadius: 8,
  },
  errorBannerText: {
    fontSize: 12,
    color: "#b91c1c",
    flex: 1,
    fontWeight: "500",
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  modalCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
  },
  modalCancelButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  modalSubmitButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#1b7d52",
    minWidth: 120,
    alignItems: "center",
  },
  modalSubmitButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },

  // Modal de Exclusão
  deleteModalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    width: "100%",
    maxWidth: 440,
    padding: 20,
  },
  deleteModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  deleteIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#fee2e2",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteModalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  deleteModalMessage: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 20,
    marginBottom: 12,
  },
  checkingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    marginBottom: 14,
  },
  checkingText: {
    fontSize: 12,
    color: "#475569",
  },
  blockedAlert: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fecaca",
    marginBottom: 14,
  },
  blockedAlertTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#991b1b",
    marginBottom: 2,
  },
  blockedAlertText: {
    fontSize: 11,
    color: "#b91c1c",
    lineHeight: 16,
  },
  deleteModalWarning: {
    fontSize: 11,
    color: "#dc2626",
    marginBottom: 14,
    fontWeight: "500",
  },
  deleteModalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 8,
  },
  deleteModalConfirmButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#dc2626",
    alignItems: "center",
  },
  deleteModalConfirmText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
  disabledButton: {
    opacity: 0.5,
  },
});
