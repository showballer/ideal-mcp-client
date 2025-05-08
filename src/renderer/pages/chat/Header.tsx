import { useEffect, useMemo, useState } from 'react';
import { Button, Tooltip } from '@fluentui/react-components';
import Mousetrap from 'mousetrap';
import {
  bundleIcon,
  WindowConsoleFilled,
  WindowConsoleRegular,
  DeleteFilled,
  DeleteRegular,
  MoreHorizontalFilled,
  MoreHorizontalRegular,
  FilterDismissRegular,
  FilterDismissFilled,
} from '@fluentui/react-icons';
import useAppearanceStore from 'stores/useAppearanceStore';
import useChatStore from 'stores/useChatStore';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from 'renderer/components/ConfirmDialog';

import { tempChatId } from 'consts';
import useNav from 'hooks/useNav';
import useToast from 'hooks/useToast';
import { IChatFolder } from 'intellichat/types';
import { isPersistedChat } from 'utils/util';
import ChatSettingsDrawer from './ChatSettingsDrawer';

const DeleteIcon = bundleIcon(DeleteFilled, DeleteRegular);

const FilterDismissIcon = bundleIcon(FilterDismissFilled, FilterDismissRegular);

const MoreHorizontalIcon = bundleIcon(
  MoreHorizontalFilled,
  MoreHorizontalRegular,
);
const InspectorShowIcon = bundleIcon(WindowConsoleFilled, WindowConsoleRegular);
const InspectorHideIcon = bundleIcon(WindowConsoleRegular, WindowConsoleFilled);

export default function Header() {
  const { t } = useTranslation();
  const { notifySuccess } = useToast();
  const navigate = useNav();
  const folder = useChatStore((state) => state.folder);
  const folders = useChatStore((state) => state.folders);
  const activeChat = useChatStore((state) => state.chat);
  const collapsed = useAppearanceStore((state) => state.sidebar.collapsed);
  const chatSidebarShow = useAppearanceStore((state) => state.chatSidebar.show);
  const toggleChatSidebarVisibility = useAppearanceStore(
    (state) => state.toggleChatSidebarVisibility,
  );
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  const chatFolder: Partial<IChatFolder> = useMemo(() => {
    if (activeChat.id !== tempChatId) {
      if (activeChat.folderId) {
        return folders[activeChat.folderId] || {};
      }
      return {};
    }
    return folder || {};
  }, [folder, activeChat.id, activeChat.folderId, folders]);

  const [delConfirmDialogOpen, setDelConfirmDialogOpen] =
    useState<boolean>(false);
  const deleteChat = useChatStore((state) => state.deleteChat);

  const onDeleteChat = async () => {
    await deleteChat();
    navigate(`/chats/${tempChatId}`);
    notifySuccess(t('Chat.Notification.Deleted'));
  };

  const getKeyword = useChatStore((state) => state.getKeyword);
  const setKeyword = useChatStore((state) => state.setKeyword);

  const keyword = isPersistedChat(activeChat)
    ? getKeyword(activeChat?.id)
    : null;

  useEffect(() => {
    Mousetrap.bind('mod+d', () => {
      if (activeChat?.id !== tempChatId) {
        setDelConfirmDialogOpen(true);
      }
    });
    Mousetrap.bind('mod+shift+r', toggleChatSidebarVisibility);
    return () => {
      Mousetrap.unbind('mod+d');
    };
  }, [activeChat?.id]);

  return (
    <div
      className={`chat-header absolute px-2.5 flex justify-between items-center ${
        collapsed
          ? 'left-[12rem] md:left-[5rem]'
          : 'left-[12rem] md:left-0 lg:left-0'
      }`}
    >
      <div className="flex-grow text-sm text-gray-300 dark:text-gray-600 text-nowrap overflow-hidden overflow-ellipsis whitespace-nowrap">
        {chatFolder.name}
      </div>
      <div className="flex justify-end items-center gap-1">
        <div className="hidden sm:block">
          <Button
            icon={
              chatSidebarShow ? (
                <InspectorHideIcon className="text-color-tertiary" />
              ) : (
                <InspectorShowIcon className="text-color-tertiary" />
              )
            }
            appearance="transparent"
            title="Inspector(Mod+shift+r)"
            onClick={toggleChatSidebarVisibility}
          />
        </div>
        {activeChat?.id && activeChat.id !== tempChatId ? (
          <>
            <Button
              icon={<DeleteIcon className="text-color-tertiary" />}
              appearance="transparent"
              title="Mod+d"
              onClick={() => setDelConfirmDialogOpen(true)}
            />
            {keyword ? (
              <Tooltip content={t('Common.ClearFilter')} relationship="label">
                <Button
                  icon={<FilterDismissIcon />}
                  appearance="transparent"
                  onClick={() => setKeyword(activeChat?.id, '')}
                />
              </Tooltip>
            ) : null}
          </>
        ) : null}
        <Button
          icon={<MoreHorizontalIcon className="text-color-tertiary" />}
          appearance="transparent"
          onClick={() => setDrawerOpen(true)}
        />
      </div>
      <ChatSettingsDrawer open={drawerOpen} setOpen={setDrawerOpen} />
      <ConfirmDialog
        open={delConfirmDialogOpen}
        setOpen={setDelConfirmDialogOpen}
        title={t('Chat.DeleteConfirmation')}
        message={t('Chat.DeleteConfirmationInfo')}
        onConfirm={onDeleteChat}
      />
    </div>
  );
}
