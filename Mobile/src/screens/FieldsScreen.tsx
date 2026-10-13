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
  Grid3x3,
  Plus,
  Search,
  Edit2,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  Building2,
  X,
  Filter,
  ChevronDown,
} from "lucide-react-native";
import { mobileApi } from "../services/api";
import { MobileFarm, MobileField } from "../types";

interface FieldsScreenProps {
  onNavigateToFarms?: () => void;
  initialFarmId?: string;
}

export function FieldsScreen({ onNavigateToFarms, initialFarmId }: FieldsScreenProps) {
  const [fields, setFields] = useState<MobileField[]>([]);
  const [farms, setFarms] = useState<MobileFarm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFarmFilter, setSelectedFarmFilter] = useState<string>(initialFarmId || "ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal de Criação / Edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<MobileField | null>(null);
  const [formFazendaId, setFormFazendaId] = useState("");
  const [formCodigo, setFormCodigo] = useState("");
  const [formDescricao, setFormDescricao] = useState("");
  const [formIdPims, setFormIdPims] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal de Exclusão
  const [fieldToDelete, setFieldToDelete] = useState<MobileField | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Seletor de Fazenda no Formulário
  const [showFarmPicker, setShowFarmPicker] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [farmsData, fieldsData] = await Promise.all([
        mobileApi.getFarms(),
        mobileApi.getFields(),
      ]);
      setFarms(farmsData);
      setFields(fieldsData);
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível carregar os dados de talhões.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setEditingField(null);
    setFormFazendaId(
      farms.length === 1 ? farms[0].id : selectedFarmFilter !== "ALL" ? selectedFarmFilter : ""
    );
    setFormCodigo("");
    setFormDescricao("");
    setFormIdPims("");
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (field: MobileField) => {
    setEditingField(field);
    setFormFazendaId(field.fazenda);
    setFormCodigo(field.codigo || "");
    setFormDescricao(field.descricao || field.nome || "");
    setFormIdPims(field.id_pims || "");
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSaveField = async () => {
    setModalError(null);

    const cleanFazendaId = formFazendaId.trim();
    const cleanCodigo = formCodigo.trim().toUpperCase();
    const cleanDescricao = formDescricao.trim();

    // 1. Validação de Fazenda
    if (!cleanFazendaId) {
      setModalError("Selecione a fazenda vinculada ao talhão.");
      return;
    }

    // 2. Validação de Código
    if (!cleanCodigo) {
      setModalError("O código do talhão é obrigatório (ex: TAL-01).");
      return;
    }

    // 3. Validação de Descrição
    if (!cleanDescricao) {
      setModalError("A descrição do talhão é obrigatória.");
      return;
    }

    // 4. Validação de duplicidade de código dentro da mesma fazenda
    const codigoDuplicado = fields.find(
      (f) =>
        f.fazenda === cleanFazendaId &&
        f.codigo?.trim().toUpperCase() === cleanCodigo &&
        (!editingField || f.id !== editingField.id)
    );

    if (codigoDuplicado) {
      const farmNome = farms.find((f) => f.id === cleanFazendaId)?.nome || "nesta fazenda";
      setModalError(`Já existe um talhão com o código "${cleanCodigo}" cadastrado na ${farmNome}.`);
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: Partial<MobileField> = {
        fazenda: cleanFazendaId,
        codigo: cleanCodigo,
        descricao: cleanDescricao,
        nome: cleanDescricao.slice(0, 100),
        id_pims: formIdPims.trim() || undefined,
      };

      if (editingField) {
        await mobileApi.updateField(editingField.id, payload);
        Alert.alert("Sucesso", `Talhão "${cleanCodigo}" atualizado com sucesso!`);
      } else {
        await mobileApi.createField(payload);
        Alert.alert("Sucesso", `Talhão "${cleanCodigo}" cadastrado com sucesso!`);
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setModalError(err?.message || "Erro ao salvar talhão no servidor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!fieldToDelete) return;
    const target = fieldToDelete;
    setIsDeleting(true);

    try {
      await mobileApi.deleteField(target.id);
      setFieldToDelete(null);
      Alert.alert("Sucesso", `Talhão "${target.codigo}" excluído com sucesso!`);
      await loadData();
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível excluir o talhão.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyId = (id: string) => {
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const filteredFields = fields.filter((f) => {
    if (selectedFarmFilter !== "ALL" && f.fazenda !== selectedFarmFilter) {
      return false;
    }
    const term = searchTerm.toLowerCase();
    const matchesCodigo = f.codigo?.toLowerCase().includes(term);
    const matchesDescricao = (f.descricao || f.nome || "").toLowerCase().includes(term);
    const matchesFazendaNome = f.fazenda_nome?.toLowerCase().includes(term);
    const matchesId = f.id?.toLowerCase().includes(term);
    const matchesPims = f.id_pims?.toLowerCase().includes(term);
    return matchesCodigo || matchesDescricao || matchesFazendaNome || matchesId || matchesPims;
  });

  const selectedFarmObj = farms.find((f) => f.id === formFazendaId);

  return (
    <View style={styles.container}>
      {/* Header da Tela */}
      <View style={styles.screenHeader}>
        <View style={styles.screenHeaderTitleGroup}>
          <View style={styles.iconBadge}>
            <Grid3x3 size={20} color="#10b981" />
          </View>
          <View>
            <Text style={styles.screenTitle}>Cadastro de Talhões</Text>
            <Text style={styles.screenSubtitle}>Lotes agrícolas e identificadores</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={loadData}
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
            <Text style={styles.createButtonText}>Novo</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Alerta se não houver fazendas cadastradas */}
      {!isLoading && farms.length === 0 && (
        <View style={styles.noFarmsBanner}>
          <AlertCircle size={18} color="#b45309" />
          <View style={{ flex: 1 }}>
            <Text style={styles.noFarmsBannerTitle}>Nenhuma fazenda cadastrada</Text>
            <Text style={styles.noFarmsBannerText}>
              Para cadastrar talhões, é necessário vincular a uma fazenda.
            </Text>
          </View>
          {onNavigateToFarms && (
            <TouchableOpacity style={styles.noFarmsBannerBtn} onPress={onNavigateToFarms}>
              <Text style={styles.noFarmsBannerBtnText}>Criar Fazenda</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Barra de Filtros e Busca */}
      <View style={styles.filterSection}>
        {/* Filtro por Fazenda (Horizontal Pills) */}
        {farms.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.farmPillsScroll}
          >
            <TouchableOpacity
              style={[
                styles.farmPill,
                selectedFarmFilter === "ALL" && styles.farmPillActive,
              ]}
              onPress={() => setSelectedFarmFilter("ALL")}
            >
              <Text
                style={[
                  styles.farmPillText,
                  selectedFarmFilter === "ALL" && styles.farmPillTextActive,
                ]}
              >
                Todas ({fields.length})
              </Text>
            </TouchableOpacity>

            {farms.map((farm) => {
              const count = fields.filter((f) => f.fazenda === farm.id).length;
              const isSelected = selectedFarmFilter === farm.id;
              return (
                <TouchableOpacity
                  key={farm.id}
                  style={[styles.farmPill, isSelected && styles.farmPillActive]}
                  onPress={() => setSelectedFarmFilter(farm.id)}
                >
                  <Text
                    style={[styles.farmPillText, isSelected && styles.farmPillTextActive]}
                    numberOfLines={1}
                  >
                    {farm.nome} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Busca textual */}
        <View style={styles.searchBox}>
          <Search size={18} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por código, descrição ou ID..."
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
          {filteredFields.length} talhão(ões) listado(s)
        </Text>
      </View>

      {/* Lista de Talhões */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>Carregando talhões...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredFields}
          keyExtractor={(item, index) => String(item?.id || index)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const farmObj = farms.find((f) => f.id === item.fazenda);
            const farmNome = item.fazenda_nome || farmObj?.nome || "Fazenda Vinculada";
            const farmFilial = item.fazenda_filial || farmObj?.filial || farmObj?.codigo || "";

            return (
              <View style={styles.fieldCard}>
                {/* Linha Superior: Código e Fazenda */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.codeGroup}>
                    <View style={styles.codeBadge}>
                      <Text style={styles.codeBadgeText}>{item.codigo}</Text>
                    </View>
                    <Text style={styles.fieldDescription} numberOfLines={2}>
                      {item.descricao || item.nome || "—"}
                    </Text>
                  </View>
                  {item.id_pims ? (
                    <View style={styles.pimsBadge}>
                      <Text style={styles.pimsBadgeText}>PIMS: {item.id_pims}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Linha da Fazenda Vinculada */}
                <View style={styles.farmRow}>
                  <Building2 size={13} color="#059669" />
                  <Text style={styles.farmNameText} numberOfLines={1}>
                    {farmNome}
                  </Text>
                  {farmFilial ? (
                    <View style={styles.filialTag}>
                      <Text style={styles.filialTagText}>Filial {farmFilial}</Text>
                    </View>
                  ) : null}
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
                    onPress={() => setFieldToDelete(item)}
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
              <Grid3x3 size={42} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>Nenhum talhão encontrado</Text>
              <Text style={styles.emptySubtitle}>
                {searchTerm || selectedFarmFilter !== "ALL"
                  ? "Tente alterar os filtros ou o termo de busca."
                  : farms.length === 0
                  ? "Cadastre uma fazenda para começar a registrar seus talhões."
                  : "Toque em '+ Novo' para cadastrar o primeiro talhão."}
              </Text>
            </View>
          }
        />
      )}

      {/* MODAL: Criar / Editar Talhão */}
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
                {editingField ? "Editar Talhão" : "Novo Talhão"}
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
              {/* Seleção de Fazenda */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Fazenda Vinculada *</Text>
                <TouchableOpacity
                  style={styles.farmSelectButton}
                  onPress={() => setShowFarmPicker(true)}
                  activeOpacity={0.7}
                >
                  <Building2 size={16} color="#64748b" />
                  <Text
                    style={[
                      styles.farmSelectText,
                      !selectedFarmObj && { color: "#94a3b8" },
                    ]}
                    numberOfLines={1}
                  >
                    {selectedFarmObj
                      ? `${selectedFarmObj.nome} (Filial ${selectedFarmObj.filial || selectedFarmObj.codigo})`
                      : "Selecione uma fazenda..."}
                  </Text>
                  <ChevronDown size={16} color="#64748b" />
                </TouchableOpacity>
                <Text style={styles.inputHelp}>
                  Unidade agrícola à qual este lote agronômico pertence.
                </Text>
              </View>

              {/* Campo Código */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Código do Talhão *</Text>
                <TextInput
                  style={[styles.input, styles.inputUppercase]}
                  placeholder="Ex: TAL-01, 102, T-A"
                  placeholderTextColor="#94a3b8"
                  value={formCodigo}
                  onChangeText={(text) => setFormCodigo(text.toUpperCase())}
                  autoCapitalize="characters"
                />
                <Text style={styles.inputHelp}>
                  Código operacional único dentro da fazenda.
                </Text>
              </View>

              {/* Campo Descrição */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Descrição do Talhão *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Talhão Pivô 01 Sede, Lote Norte Soja"
                  placeholderTextColor="#94a3b8"
                  value={formDescricao}
                  onChangeText={setFormDescricao}
                />
                <Text style={styles.inputHelp}>
                  Identificador textual ou descrição das atividades.
                </Text>
              </View>

              {/* Campo ID PIMS (Opcional) */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>ID do PIMS (Opcional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: 90210, TLH-PIMS-01"
                  placeholderTextColor="#94a3b8"
                  value={formIdPims}
                  onChangeText={setFormIdPims}
                />
                <Text style={styles.inputHelp}>
                  Identificador correspondente no sistema PIMS (não obrigatório).
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
                onPress={handleSaveField}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalSubmitButtonText}>
                    {editingField ? "Salvar" : "Cadastrar"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL PICKER: Selecionar Fazenda para o Talhão */}
      <Modal
        visible={showFarmPicker}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowFarmPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar Fazenda</Text>
              <TouchableOpacity onPress={() => setShowFarmPicker(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={farms}
              keyExtractor={(f) => f.id}
              contentContainerStyle={{ padding: 12, gap: 8 }}
              renderItem={({ item }) => {
                const isSelected = item.id === formFazendaId;
                return (
                  <TouchableOpacity
                    style={[
                      styles.farmPickerItem,
                      isSelected && styles.farmPickerItemSelected,
                    ]}
                    onPress={() => {
                      setFormFazendaId(item.id);
                      setShowFarmPicker(false);
                    }}
                  >
                    <Building2
                      size={18}
                      color={isSelected ? "#10b981" : "#64748b"}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.farmPickerName,
                          isSelected && styles.farmPickerNameSelected,
                        ]}
                      >
                        {item.nome}
                      </Text>
                      {item.filial && (
                        <Text style={styles.farmPickerFilial}>
                          Filial: {item.filial}
                        </Text>
                      )}
                    </View>
                    {isSelected && <Check size={18} color="#10b981" />}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={{ padding: 24, alignItems: "center" }}>
                  <Text style={{ fontSize: 13, color: "#94a3b8" }}>
                    Nenhuma fazenda cadastrada.
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* MODAL: Confirmação de Exclusão de Talhão */}
      <Modal
        visible={Boolean(fieldToDelete)}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setFieldToDelete(null)}
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
              Tem certeza que deseja excluir o talhão{" "}
              <Text style={{ fontWeight: "700" }}>"{fieldToDelete?.codigo}"</Text>{" "}
              ({fieldToDelete?.descricao || fieldToDelete?.nome})?
            </Text>

            <Text style={styles.deleteModalWarning}>
              Esta ação é definitiva e removerá este talhão da fazenda.
            </Text>

            <View style={styles.deleteModalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setFieldToDelete(null)}
                disabled={isDeleting}
              >
                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmDeleteButton}
                onPress={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.confirmDeleteButtonText}>Sim, Excluir</Text>
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
  noFarmsBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fef3c7",
    borderBottomWidth: 1,
    borderBottomColor: "#fde68a",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  noFarmsBannerTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#92400e",
  },
  noFarmsBannerText: {
    fontSize: 11,
    color: "#b45309",
    marginTop: 1,
  },
  noFarmsBannerBtn: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#fde68a",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  noFarmsBannerBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#92400e",
  },
  filterSection: {
    backgroundColor: "#ffffff",
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  farmPillsScroll: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 8,
  },
  farmPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  farmPillActive: {
    backgroundColor: "#10b981",
    borderColor: "#10b981",
  },
  farmPillText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "600",
  },
  farmPillTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    height: 40,
    gap: 8,
    marginTop: 4,
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
    marginHorizontal: 16,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  fieldCard: {
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
    marginBottom: 8,
  },
  codeGroup: {
    gap: 6,
  },
  codeBadge: {
    backgroundColor: "#0f172a",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  codeBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
    fontFamily: "monospace",
  },
  fieldDescription: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  farmRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  farmNameText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0f766e",
    maxWidth: 180,
  },
  filialTag: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  filialTagText: {
    fontSize: 10,
    color: "#059669",
    fontWeight: "700",
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
  pickerModalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    width: "100%",
    maxHeight: "75%",
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
  farmSelectButton: {
    height: 44,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  farmSelectText: {
    flex: 1,
    fontSize: 13,
    color: "#0f172a",
  },
  farmPickerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  farmPickerItemSelected: {
    borderColor: "#10b981",
    backgroundColor: "rgba(16, 185, 129, 0.08)",
  },
  farmPickerName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  farmPickerNameSelected: {
    color: "#059669",
    fontWeight: "700",
  },
  farmPickerFilial: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
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
    fontFamily: "monospace",
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
  pimsBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  pimsBadgeText: {
    fontSize: 10,
    color: "#475569",
    fontWeight: "600",
  },
});
